const fs = require('fs');
const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const pool = require('../db');
const { encryptFile, decryptFile, FILE_MAGIC } = require('./crypto');
const { getConfig } = require('./config');
const { BackupError } = require('./errors');
const { logAudit } = require('./store');

const APP_NAME = 'ResearchHub';
const MANIFEST_VERSION = 1;
const INSERT_CHUNK = 100;

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function tableIdent(schema, table) {
  return quoteIdent(`${schema}.${table}`);
}

function tempDir() {
  const root = process.env.BACKUP_TEMP_DIR || path.join(os.tmpdir(), 'researchhub-backups');
  return fsp.mkdir(root, { recursive: true, mode: 0o700 }).then(() => fsp.mkdtemp(path.join(root, 'downloadable-')));
}

async function cleanup(dir) {
  if (!dir) return;
  await fsp.rm(dir, { recursive: true, force: true }).catch(() => {});
}

async function getApplicationTables(client) {
  const { rows } = await client.query(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`
  );
  return rows.map((row) => row.table_name);
}

async function getTableColumns(client, table) {
  const { rows } = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((row) => row.column_name);
}

async function dumpDatabaseToJson(client) {
  const tables = await getApplicationTables(client);
  const payload = {
    app: APP_NAME,
    manifest_version: MANIFEST_VERSION,
    kind: 'downloadable_database',
    created_at: new Date().toISOString(),
    tables: []
  };

  for (const table of tables) {
    const columns = await getTableColumns(client, table);
    const { rows } = await client.query(`SELECT * FROM ${tableIdent('public', table)}`);
    payload.tables.push({ name: table, columns, rows });
  }

  return payload;
}

function validateDownloadablePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new BackupError('Backup file is not a valid JSON object.', { code: 'BACKUP_INVALID_FORMAT' });
  }
  if (payload.app !== APP_NAME) {
    throw new BackupError('Backup file was not created by this application.', { code: 'BACKUP_INVALID_APP' });
  }
  if (payload.manifest_version !== MANIFEST_VERSION) {
    throw new BackupError('Backup file version is not supported by this version.', { code: 'BACKUP_INVALID_VERSION' });
  }
  if (!Array.isArray(payload.tables)) {
    throw new BackupError('Backup file is missing table data.', { code: 'BACKUP_INVALID_TABLES' });
  }
  for (const table of payload.tables) {
    if (!table || !table.name || !Array.isArray(table.columns) || !Array.isArray(table.rows)) {
      throw new BackupError('Backup file contains an invalid table entry.', { code: 'BACKUP_INVALID_TABLE' });
    }
  }
  return payload;
}

async function getInsertOrder(client, tableNames) {
  const tableSet = new Set(tableNames);
  const parentsOf = new Map();
  for (const name of tableNames) parentsOf.set(name, new Set());

  const { rows } = await client.query(
    `SELECT kcu.table_name AS child_table, ccu.table_name AS parent_table
     FROM information_schema.referential_constraints rc
     JOIN information_schema.key_column_usage kcu
       ON kcu.constraint_name = rc.constraint_name AND kcu.table_schema = rc.constraint_schema
     JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = rc.constraint_name AND ccu.table_schema = rc.constraint_schema
     WHERE kcu.table_schema = 'public' AND ccu.table_schema = 'public'`
  );
  for (const row of rows) {
    if (
      tableSet.has(row.child_table) &&
      tableSet.has(row.parent_table) &&
      row.child_table !== row.parent_table
    ) {
      parentsOf.get(row.child_table).add(row.parent_table);
    }
  }

  const visited = new Set();
  const order = [];
  const visiting = new Set();
  const visit = (name) => {
    if (visited.has(name)) return;
    if (visiting.has(name)) return; // cycle: break it
    visiting.add(name);
    for (const parent of parentsOf.get(name) || []) visit(parent);
    visiting.delete(name);
    visited.add(name);
    order.push(name);
  };
  for (const name of tableNames) visit(name);
  return order;
}

async function insertRows(client, table, columns, rows) {
  if (!rows.length) return;
  const colList = columns.map((col) => quoteIdent(col)).join(', ');

  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK);
    const values = [];
    const valueStrings = [];
    let param = 1;
    for (const row of chunk) {
      const parts = [];
      for (const col of columns) {
        values.push(row[col] !== undefined ? row[col] : null);
        parts.push(`$${param}`);
        param += 1;
      }
      valueStrings.push(`(${parts.join(', ')})`);
    }
    await client.query(
      `INSERT INTO ${tableIdent('public', table)} (${colList}) VALUES ${valueStrings.join(', ')}`,
      values
    );
  }
}

async function resetSequences(client, tableNames) {
  for (const table of tableNames) {
    const { rows } = await client.query(
      `SELECT a.attname AS column_name, pg_get_serial_sequence(c.oid, a.attname) AS seq_name
       FROM pg_attribute a
       JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = $1
         AND a.attnum > 0 AND NOT a.attisdropped
         AND pg_get_serial_sequence(c.oid, a.attname) IS NOT NULL`,
      [table]
    );
    for (const row of rows) {
      const seq = row.seq_name;
      const column = quoteIdent(row.column_name);
      await client.query(
        `SELECT setval($1::regclass, COALESCE((SELECT max(${column}) FROM ${tableIdent('public', table)}), 1), true)`,
        [seq]
      );
    }
  }
}

async function encryptBuffer(buffer, tempDirPath, fileName) {
  const config = getConfig();
  const plainPath = path.join(tempDirPath, 'backup.plain');
  await fsp.writeFile(plainPath, buffer, { mode: 0o600 });

  if (config.encryptionKey) {
    const encPath = path.join(tempDirPath, `${fileName}.enc`);
    await encryptFile(plainPath, encPath);
    await fsp.rm(plainPath, { force: true }).catch(() => {});
    return { buffer: await fsp.readFile(encPath), fileName: `${fileName}.enc`, encrypted: true };
  }

  await fsp.rm(plainPath, { force: true }).catch(() => {});
  return { buffer, fileName: `${fileName}.json`, encrypted: false };
}

async function decryptBuffer(buffer, tempDirPath, fileName) {
  const config = getConfig();
  const hasMagic = buffer.length >= FILE_MAGIC.length && buffer.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC);

  if (!hasMagic) {
    return buffer;
  }

  if (!config.encryptionKey) {
    throw new BackupError('This backup is encrypted but BACKUP_ENCRYPTION_KEY is not configured on this server.', {
      status: 503,
      code: 'ENCRYPTION_NOT_CONFIGURED'
    });
  }

  const encPath = path.join(tempDirPath, `${fileName}.enc`);
  const plainPath = path.join(tempDirPath, 'backup.plain');
  await fsp.writeFile(encPath, buffer, { mode: 0o600 });
  await decryptFile(encPath, plainPath);
  const plaintext = await fsp.readFile(plainPath);
  await fsp.rm(encPath, { force: true }).catch(() => {});
  await fsp.rm(plainPath, { force: true }).catch(() => {});
  return plaintext;
}

module.exports = {
  APP_NAME,
  MANIFEST_VERSION,
  dumpDatabaseToJson,
  validateDownloadablePayload,
  getInsertOrder,
  insertRows,
  resetSequences,
  encryptBuffer,
  decryptBuffer,
  quoteIdent,
  tableIdent,
  tempDir,
  cleanup
};
