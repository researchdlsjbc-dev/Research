const { spawn } = require('child_process');
const path = require('path');
const { BackupError, safeErrorMessage } = require('../../api/backup/errors');
const { sameDatabase } = require('../../api/backup/validation');
const { normalizeBackupDatabaseUrl } = require('../../api/backup/databaseUrl');

const MAX_CAPTURED_STDERR = 12000;

function quoteIdent(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function parsePostgresUrl(raw, label = 'database URL') {
  if (!raw) {
    throw new BackupError(`${label} is not set.`, { status: 503, code: 'DATABASE_URL_MISSING' });
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    throw new BackupError(`${label} is not a valid PostgreSQL connection URL.`, {
      status: 503,
      code: 'DATABASE_URL_INVALID'
    });
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new BackupError(`${label} must use the postgres:// or postgresql:// scheme.`, {
      status: 503,
      code: 'DATABASE_URL_INVALID'
    });
  }
  const database = decodeURIComponent((parsed.pathname || '').replace(/^\//, ''));
  return {
    host: parsed.hostname,
    port: parsed.port || '5432',
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    database,
    sslmode: parsed.searchParams.get('sslmode') || null
  };
}

function isLocalHost(host) {
  return ['localhost', '127.0.0.1', '::1'].includes(String(host).toLowerCase());
}

function supabaseProjectRef(info) {
  const direct = /^db\.([a-z0-9-]+)\.supabase\.co$/i.exec(String(info.host || ''));
  if (direct) return direct[1].toLowerCase();
  const pooled = /^postgres\.([a-z0-9-]+)$/i.exec(String(info.user || ''));
  return pooled ? pooled[1].toLowerCase() : null;
}

function buildPgEnv(rawUrl, baseEnv = process.env) {
  const info = parsePostgresUrl(rawUrl);
  const env = {
    ...baseEnv,
    PGPASSWORD: info.password,
    PGCONNECT_TIMEOUT: baseEnv.PGCONNECT_TIMEOUT || '30'
  };
  if (info.sslmode) env.PGSSLMODE = info.sslmode;
  else env.PGSSLMODE = isLocalHost(info.host) ? 'disable' : 'require';
  return { env, info };
}

function assertBackupConnection(rawUrl) {
  const info = parsePostgresUrl(normalizeBackupDatabaseUrl(rawUrl), 'BACKUP_DATABASE_URL');
  if (String(info.port) === '6543' && process.env.BACKUP_ALLOW_POOLER !== '1') {
    throw new BackupError(
      'BACKUP_DATABASE_URL points at a transaction pooler (port 6543). pg_dump requires a direct connection or session pooler on port 5432. Set BACKUP_DATABASE_URL to the session/direct connection string.',
      { status: 503, code: 'BACKUP_POOLER_NOT_SUPPORTED' }
    );
  }
  if (!info.database) {
    throw new BackupError('BACKUP_DATABASE_URL does not include a database name.', {
      status: 503,
      code: 'DATABASE_URL_INVALID'
    });
  }
  return info;
}

function parseSchemaList() {
  const configured = String(process.env.BACKUP_PG_SCHEMAS || 'public')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.includes('*')) {
    throw new BackupError(
      'BACKUP_PG_SCHEMAS=* is not supported. Dumping every Supabase-managed schema is unsafe; list the schemas owned by your application (default: public).',
      { status: 503, code: 'BACKUP_SCHEMA_ALL_NOT_SUPPORTED' }
    );
  }
  for (const schema of configured) {
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(schema)) {
      throw new BackupError(`Invalid schema name in BACKUP_PG_SCHEMAS: ${schema}`, {
        status: 503,
        code: 'BACKUP_SCHEMA_INVALID'
      });
    }
  }
  return configured;
}

function runBinary(binary, args, { env = process.env, timeoutMs = 30 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      env,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let settled = false;

    const append = (current, chunk) => {
      if (current.length >= MAX_CAPTURED_STDERR) return current;
      return (current + chunk.toString('utf8')).slice(0, MAX_CAPTURED_STDERR);
    };

    child.stdout.on('data', (chunk) => { stdout = append(stdout, chunk); });
    child.stderr.on('data', (chunk) => { stderr = append(stderr, chunk); });

    const timer = setTimeout(() => {
      if (!settled) {
        child.kill('SIGKILL');
        settled = true;
        reject(new BackupError(`${path.basename(binary)} timed out after ${Math.round(timeoutMs / 1000)} seconds.`, {
          code: 'PG_BINARY_TIMEOUT'
        }));
      }
    }, timeoutMs);

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err.code === 'ENOENT') {
        reject(new BackupError(
          `${binary} was not found. Install PostgreSQL client tools on the backup worker (for GitHub Actions: postgresql-client).`,
          { status: 500, code: 'PG_BINARY_MISSING' }
        ));
      } else {
        reject(new BackupError(`${path.basename(binary)} failed to start: ${safeErrorMessage(err)}`, {
          code: 'PG_BINARY_FAILED'
        }));
      }
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new BackupError(
        `${path.basename(binary)} exited with code ${code}: ${stderr.trim().slice(0, 1200) || 'no error output'}`,
        { code: 'PG_BINARY_EXIT' }
      ));
    });
  });
}

async function getPgDumpVersion() {
  const { stdout } = await runBinary('pg_dump', ['--version'], { timeoutMs: 15000 });
  return stdout.trim();
}

async function getPgRestoreVersion() {
  const { stdout } = await runBinary('pg_restore', ['--version'], { timeoutMs: 15000 });
  return stdout.trim();
}

async function isPgDumpAvailable() {
  try {
    await getPgDumpVersion();
    return true;
  } catch (_) {
    return false;
  }
}

function buildDumpArgs(rawUrl, filePath, schemas, snapshot = null) {
  const info = parsePostgresUrl(normalizeBackupDatabaseUrl(rawUrl), 'BACKUP_DATABASE_URL');
  const includeOwners = process.env.BACKUP_PG_DUMP_INCLUDE_OWNERS === '1';
  const args = [
    '--format=custom',
    '--compress=9',
    '--no-password',
    '--lock-wait-timeout=60s',
    '--file', filePath,
    '--host', info.host,
    '--port', info.port,
    '--username', info.user,
    '--dbname', info.database
  ];
  if (!includeOwners) args.push('--no-owner', '--no-privileges');
  if (snapshot) args.push('--snapshot', snapshot);
  for (const schema of schemas) args.push('--schema', schema);
  return { args, info, includeOwners };
}

async function pgDumpToFile(rawUrl, filePath, { timeoutMs = null, snapshot = null } = {}) {
  assertBackupConnection(rawUrl);
  const schemas = parseSchemaList();
  const { args, info, includeOwners } = buildDumpArgs(rawUrl, filePath, schemas, snapshot);
  const { env } = buildPgEnv(rawUrl);
  const limit = timeoutMs || Number(process.env.PG_DUMP_TIMEOUT_MS || 30 * 60 * 1000);
  const version = await getPgDumpVersion();
  await runBinary('pg_dump', args, { env, timeoutMs: limit });
  return {
    schemas,
    includeOwners,
    pgDumpVersion: version,
    host: info.host,
    database: info.database,
    options: {
      format: 'custom',
      compression: 9,
      noOwner: !includeOwners,
      noPrivileges: !includeOwners,
      lockWaitTimeout: '60s',
      snapshot: snapshot || null
    }
  };
}

function buildRestoreArgs(rawUrl, filePath) {
  const info = parsePostgresUrl(rawUrl, 'RESTORE_STAGING_DATABASE_URL');
  const args = [
    '--clean',
    '--if-exists',
    '--exit-on-error',
    '--single-transaction',
    '--no-owner',
    '--no-privileges',
    '--no-password',
    '--host', info.host,
    '--port', info.port,
    '--username', info.user,
    '--dbname', info.database,
    filePath
  ];
  return { args, info };
}

async function pgRestoreFromFile(rawUrl, filePath, { timeoutMs = null } = {}) {
  const { args } = buildRestoreArgs(rawUrl, filePath);
  const { env } = buildPgEnv(rawUrl);
  const limit = timeoutMs || Number(process.env.PG_RESTORE_TIMEOUT_MS || 45 * 60 * 1000);
  const version = await getPgRestoreVersion();
  await runBinary('pg_restore', args, { env, timeoutMs: limit });
  return { pgRestoreVersion: version };
}

async function pgRestoreList(filePath) {
  const { stdout } = await runBinary('pg_restore', ['--list', filePath], { timeoutMs: 120000 });
  return stdout;
}

function assertSafeStagingTarget(stagingUrl, productionUrl) {
  if (!stagingUrl) {
    throw new BackupError(
      'RESTORE_STAGING_DATABASE_URL is not set. Restore validation requires a separate staging PostgreSQL database.',
      { status: 503, code: 'STAGING_NOT_CONFIGURED' }
    );
  }
  const staging = parsePostgresUrl(stagingUrl, 'RESTORE_STAGING_DATABASE_URL');
  const production = parsePostgresUrl(productionUrl, 'BACKUP_DATABASE_URL');

  if (String(staging.port) === '6543') {
    throw new BackupError('RESTORE_STAGING_DATABASE_URL must use a direct/session connection on port 5432, not the transaction pooler.', {
      status: 400,
      code: 'STAGING_POOLER_NOT_SUPPORTED'
    });
  }
  if (sameDatabase(stagingUrl, productionUrl)) {
    throw new BackupError('Refusing to restore: the staging database is the same as the production database.', {
      status: 400,
      code: 'STAGING_MATCHES_PRODUCTION'
    });
  }
  const stagingProject = supabaseProjectRef(staging);
  const productionProject = supabaseProjectRef(production);
  if (stagingProject && productionProject && stagingProject === productionProject && process.env.RESTORE_ALLOW_SAME_HOST !== '1') {
    throw new BackupError(
      'Refusing to restore: the staging database belongs to the same Supabase project as production. Use a separate staging project.',
      { status: 400, code: 'STAGING_SAME_SUPABASE_PROJECT' }
    );
  }
  if (staging.host.toLowerCase() === production.host.toLowerCase() && process.env.RESTORE_ALLOW_SAME_HOST !== '1') {
    throw new BackupError(
      'Refusing to restore: the staging database is on the same host as production. Use a separate staging project, or set RESTORE_ALLOW_SAME_HOST=1 only after verifying the database is isolated.',
      { status: 400, code: 'STAGING_SAME_HOST' }
    );
  }
  if (/prod/i.test(staging.database) && process.env.RESTORE_ALLOW_PROD_NAME !== '1') {
    throw new BackupError('Refusing to restore into a database whose name contains "prod".', {
      status: 400,
      code: 'STAGING_LOOKS_PRODUCTION'
    });
  }
  if (!/(staging|restore|test|sandbox|rehearsal)/i.test(staging.database) && process.env.RESTORE_ALLOW_NON_STAGING !== '1') {
    throw new BackupError(
      'Refusing to restore: the staging database name must contain staging, restore, test, sandbox, or rehearsal. Set RESTORE_ALLOW_NON_STAGING=1 only if you have verified the target.',
      { status: 400, code: 'STAGING_NAME_NOT_SAFE' }
    );
  }
  return { staging, production };
}

async function connectPgClient(rawUrl) {
  const { Client } = require('pg');
  const info = parsePostgresUrl(rawUrl);
  const client = new Client({
    connectionString: rawUrl,
    ssl: isLocalHost(info.host) ? false : { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

async function collectDatabaseManifest(client, schemas) {
  const version = await client.query('SHOW server_version');
  const database = await client.query('SELECT current_database() AS name, current_user AS username');
  const tables = await client.query(
    `SELECT schemaname, tablename
     FROM pg_tables
     WHERE schemaname = ANY($1::text[])
     ORDER BY schemaname, tablename`,
    [schemas]
  );

  const tableRows = [];
  let totalRows = 0;
  for (const table of tables.rows) {
    const identifier = `${quoteIdent(table.schemaname)}.${quoteIdent(table.tablename)}`;
    const count = await client.query(`SELECT count(*)::bigint AS count FROM ${identifier}`);
    const rows = Number(count.rows[0].count);
    tableRows.push({ schema: table.schemaname, name: table.tablename, rows });
    totalRows += rows;
  }

  const indexes = await client.query(
    `SELECT count(*)::int AS count FROM pg_indexes WHERE schemaname = ANY($1::text[])`,
    [schemas]
  );
  const constraints = await client.query(
    `SELECT count(*)::int AS count
     FROM pg_constraint c
     JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE n.nspname = ANY($1::text[])`,
    [schemas]
  );
  const sequences = await client.query(
    `SELECT schemaname, sequencename
     FROM pg_sequences
     WHERE schemaname = ANY($1::text[])
     ORDER BY schemaname, sequencename`,
    [schemas]
  );
  const extensions = await client.query(
    `SELECT extname, extversion FROM pg_extension ORDER BY extname`
  );

  return {
    database: database.rows[0].name,
    username: database.rows[0].username,
    server_version: version.rows[0].server_version,
    server_version_num: Number((await client.query('SHOW server_version_num')).rows[0].server_version_num),
    schemas,
    tables: tableRows,
    table_count: tableRows.length,
    total_rows: totalRows,
    index_count: Number(indexes.rows[0].count),
    constraint_count: Number(constraints.rows[0].count),
    sequences: sequences.rows.map((row) => ({ schema: row.schemaname, name: row.sequencename })),
    sequence_count: sequences.rows.length,
    extensions: extensions.rows,
    counted_at: new Date().toISOString()
  };
}

function serverMajorFromVersion(version) {
  const match = String(version || '').match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

async function verifyRestoredDatabase(client, manifest) {
  const schemas = manifest.schemas && manifest.schemas.length ? manifest.schemas : ['public'];
  const actual = await collectDatabaseManifest(client, schemas);
  const expectedTables = new Map((manifest.tables || []).map((table) => [`${table.schema}.${table.name}`, Number(table.rows)]));
  const actualTables = new Map(actual.tables.map((table) => [`${table.schema}.${table.name}`, Number(table.rows)]));

  const missingTables = [...expectedTables.keys()].filter((key) => !actualTables.has(key));
  const unexpectedTables = [...actualTables.keys()].filter((key) => !expectedTables.has(key));
  const rowCountMismatches = [];
  for (const [key, expected] of expectedTables) {
    if (!actualTables.has(key)) continue;
    const found = actualTables.get(key);
    if (found !== expected) rowCountMismatches.push({ table: key, expected, actual: found });
  }

  const expectedMajor = serverMajorFromVersion(manifest.server_version);
  const actualMajor = serverMajorFromVersion(actual.server_version);
  const restoreVersionCompatible = !expectedMajor || !actualMajor || actualMajor >= expectedMajor;

  const checks = {
    ok: missingTables.length === 0 &&
      unexpectedTables.length === 0 &&
      rowCountMismatches.length === 0 &&
      actual.sequence_count >= Number(manifest.sequence_count || 0) &&
      actual.constraint_count >= Number(manifest.constraint_count || 0) &&
      restoreVersionCompatible,
    expected_server_version: manifest.server_version,
    actual_server_version: actual.server_version,
    restore_version_compatible: restoreVersionCompatible,
    expected_tables: expectedTables.size,
    actual_tables: actualTables.size,
    missing_tables: missingTables,
    unexpected_tables: unexpectedTables,
    row_count_mismatches: rowCountMismatches,
    expected_sequences: Number(manifest.sequence_count || 0),
    actual_sequences: actual.sequence_count,
    expected_constraints: Number(manifest.constraint_count || 0),
    actual_constraints: actual.constraint_count,
    expected_indexes: Number(manifest.index_count || 0),
    actual_indexes: actual.index_count,
    total_rows_expected: Number(manifest.total_rows || 0),
    total_rows_actual: actual.total_rows,
    verified_at: new Date().toISOString()
  };
  return checks;
}

module.exports = {
  parsePostgresUrl,
  buildPgEnv,
  assertBackupConnection,
  parseSchemaList,
  runBinary,
  getPgDumpVersion,
  getPgRestoreVersion,
  isPgDumpAvailable,
  pgDumpToFile,
  pgRestoreFromFile,
  pgRestoreList,
  assertSafeStagingTarget,
  collectDatabaseManifest,
  verifyRestoredDatabase,
  buildDumpArgs,
  buildRestoreArgs,
  connectPgClient,
  quoteIdent
};
