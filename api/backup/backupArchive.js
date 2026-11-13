const crypto = require('crypto');
const AdmZip = require('adm-zip');
const { BackupError } = require('./errors');
const { APP_NAME, MANIFEST_VERSION } = require('./constants');

const MANIFEST_FILE = 'manifest.json';
const ENCRYPTED_PAYLOAD_FILE = 'database.json.enc';
const PLAIN_PAYLOAD_FILE = 'database.json';
const ARCHIVE_KIND = 'downloadable_archive';
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_PAYLOAD_BYTES = 128 * 1024 * 1024;

function hashBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function isZipBuffer(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length >= ZIP_MAGIC.length &&
    buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)
  );
}

function createDownloadableArchive({ payloadBuffer, fileName, encrypted, tables, rows }) {
  if (!Buffer.isBuffer(payloadBuffer) || !payloadBuffer.length) {
    throw new BackupError('No database payload was provided for the backup archive.', {
      status: 500,
      code: 'BACKUP_ARCHIVE_EMPTY'
    });
  }
  const payloadName = encrypted ? ENCRYPTED_PAYLOAD_FILE : PLAIN_PAYLOAD_FILE;
  const manifest = {
    app: APP_NAME,
    manifest_version: MANIFEST_VERSION,
    kind: ARCHIVE_KIND,
    created_at: new Date().toISOString(),
    payload: payloadName,
    encrypted: Boolean(encrypted),
    payload_size: payloadBuffer.length,
    payload_sha256: hashBuffer(payloadBuffer),
    tables: Array.isArray(tables) ? tables : [],
    row_count: Number.isFinite(rows) ? rows : 0
  };

  const zip = new AdmZip();
  zip.addFile(MANIFEST_FILE, Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
  zip.addFile(payloadName, payloadBuffer);

  return {
    buffer: zip.toBuffer(),
    fileName: `${fileName}.zip`,
    manifest
  };
}

function readEntry(entries, name, maxBytes) {
  const entry = entries.find((item) => item.entryName === name);
  if (!entry) return null;
  const declared = Number(entry.header && entry.header.size);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new BackupError('The ZIP backup contains an entry that is too large.', {
      status: 400,
      code: 'BACKUP_ARCHIVE_TOO_LARGE'
    });
  }
  const data = entry.getData();
  if (data.length > maxBytes) {
    throw new BackupError('The ZIP backup contains an entry that is too large.', {
      status: 400,
      code: 'BACKUP_ARCHIVE_TOO_LARGE'
    });
  }
  return data;
}

function readDownloadableArchive(buffer) {
  if (!isZipBuffer(buffer)) {
    throw new BackupError('The uploaded file is not a ZIP backup.', {
      status: 400,
      code: 'BACKUP_ARCHIVE_INVALID'
    });
  }

  let entries;
  try {
    entries = new AdmZip(buffer).getEntries();
  } catch (_) {
    throw new BackupError('The ZIP backup is corrupt or unreadable.', {
      status: 400,
      code: 'BACKUP_ARCHIVE_INVALID'
    });
  }

  const manifestBuffer = readEntry(entries, MANIFEST_FILE, MAX_MANIFEST_BYTES);
  if (!manifestBuffer) {
    throw new BackupError('The ZIP backup is missing manifest.json.', {
      status: 400,
      code: 'BACKUP_ARCHIVE_INVALID'
    });
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestBuffer.toString('utf8'));
  } catch (_) {
    throw new BackupError('The ZIP backup manifest is not valid JSON.', {
      status: 400,
      code: 'BACKUP_ARCHIVE_INVALID'
    });
  }

  if (!manifest || manifest.app !== APP_NAME) {
    throw new BackupError('The ZIP backup was not created by this application.', {
      status: 400,
      code: 'BACKUP_INVALID_APP'
    });
  }
  if (manifest.manifest_version !== MANIFEST_VERSION) {
    throw new BackupError('The ZIP backup version is not supported by this version.', {
      status: 400,
      code: 'BACKUP_INVALID_VERSION'
    });
  }
  if (manifest.kind !== ARCHIVE_KIND) {
    throw new BackupError('The ZIP backup manifest is missing required fields.', {
      status: 400,
      code: 'BACKUP_ARCHIVE_INVALID'
    });
  }

  const declared = typeof manifest.payload === 'string' ? manifest.payload : null;
  const candidates = declared ? [declared] : [ENCRYPTED_PAYLOAD_FILE, PLAIN_PAYLOAD_FILE];
  let payloadBuffer = null;
  let payloadName = null;
  for (const name of candidates) {
    if (name !== ENCRYPTED_PAYLOAD_FILE && name !== PLAIN_PAYLOAD_FILE) continue;
    const data = readEntry(entries, name, MAX_PAYLOAD_BYTES);
    if (data) {
      payloadBuffer = data;
      payloadName = name;
      break;
    }
  }

  if (!payloadBuffer) {
    throw new BackupError('The ZIP backup is missing the database payload.', {
      status: 400,
      code: 'BACKUP_ARCHIVE_INVALID'
    });
  }
  if (manifest.payload_sha256) {
    if (
      typeof manifest.payload_sha256 !== 'string' ||
      hashBuffer(payloadBuffer) !== manifest.payload_sha256.toLowerCase()
    ) {
      throw new BackupError('The ZIP backup payload failed its checksum check.', {
        status: 400,
        code: 'BACKUP_ARCHIVE_CHECKSUM_MISMATCH'
      });
    }
  }

  return { manifest, payloadBuffer, payloadName };
}

module.exports = {
  MANIFEST_FILE,
  ENCRYPTED_PAYLOAD_FILE,
  PLAIN_PAYLOAD_FILE,
  MAX_PAYLOAD_BYTES,
  isZipBuffer,
  createDownloadableArchive,
  readDownloadableArchive
};
