const test = require('node:test');
const assert = require('node:assert/strict');
const AdmZip = require('adm-zip');

const {
  MANIFEST_FILE,
  ENCRYPTED_PAYLOAD_FILE,
  PLAIN_PAYLOAD_FILE,
  isZipBuffer,
  createDownloadableArchive,
  readDownloadableArchive
} = require('../api/backup/backupArchive');

function buildArchive(manifest, files) {
  const zip = new AdmZip();
  zip.addFile(MANIFEST_FILE, Buffer.from(JSON.stringify(manifest), 'utf8'));
  for (const [name, data] of Object.entries(files)) zip.addFile(name, data);
  return zip.toBuffer();
}

function baseManifest(overrides = {}) {
  return {
    app: 'ResearchHub',
    manifest_version: 1,
    kind: 'downloadable_archive',
    created_at: new Date().toISOString(),
    payload: PLAIN_PAYLOAD_FILE,
    encrypted: false,
    ...overrides
  };
}

test('isZipBuffer detects ZIP magic only', () => {
  const zip = createDownloadableArchive({
    payloadBuffer: Buffer.from('{"hello":"world"}'),
    fileName: 'researchhub-backup-test',
    encrypted: false,
    tables: ['authors'],
    rows: 1
  });
  assert.equal(isZipBuffer(zip.buffer), true);
  assert.equal(isZipBuffer(Buffer.from('RHBKUP01not-a-zip')), false);
  assert.equal(isZipBuffer(Buffer.alloc(0)), false);
});

test('encrypted archive round-trips the database payload', () => {
  const payload = Buffer.from('RHBKUP01-fake-encrypted-payload');
  const result = createDownloadableArchive({
    payloadBuffer: payload,
    fileName: 'researchhub-backup-2026-11-14T00-00-00',
    encrypted: true,
    tables: ['authors', 'research'],
    rows: 42
  });

  assert.equal(result.fileName, 'researchhub-backup-2026-11-14T00-00-00.zip');
  assert.equal(result.manifest.encrypted, true);
  assert.equal(result.manifest.payload, ENCRYPTED_PAYLOAD_FILE);
  assert.equal(result.manifest.tables.length, 2);
  assert.equal(result.manifest.row_count, 42);
  assert.match(result.manifest.payload_sha256, /^[0-9a-f]{64}$/);

  const read = readDownloadableArchive(result.buffer);
  assert.equal(read.manifest.app, 'ResearchHub');
  assert.equal(read.payloadName, ENCRYPTED_PAYLOAD_FILE);
  assert.deepEqual(read.payloadBuffer, payload);
});

test('plaintext archive round-trips the database payload', () => {
  const payload = Buffer.from('{"app":"ResearchHub"}');
  const result = createDownloadableArchive({
    payloadBuffer: payload,
    fileName: 'researchhub-backup-test',
    encrypted: false,
    tables: ['authors'],
    rows: 0
  });

  const read = readDownloadableArchive(result.buffer);
  assert.equal(read.payloadName, PLAIN_PAYLOAD_FILE);
  assert.deepEqual(read.payloadBuffer, payload);
});

test('non-ZIP uploads are rejected', () => {
  assert.throws(
    () => readDownloadableArchive(Buffer.from('{"app":"ResearchHub"}')),
    /not a ZIP backup/
  );
});

test('foreign or newer archives are rejected', () => {
  const payload = Buffer.from('data');
  assert.throws(
    () => readDownloadableArchive(buildArchive(baseManifest({ app: 'OtherApp' }), { [PLAIN_PAYLOAD_FILE]: payload })),
    /not created by this application/
  );
  assert.throws(
    () => readDownloadableArchive(buildArchive(baseManifest({ manifest_version: 99 }), { [PLAIN_PAYLOAD_FILE]: payload })),
    /version is not supported/
  );
});

test('missing or tampered payloads are rejected', () => {
  const manifest = baseManifest({ payload_sha256: '0'.repeat(64) });
  assert.throws(
    () => readDownloadableArchive(buildArchive(manifest, { [PLAIN_PAYLOAD_FILE]: Buffer.from('data') })),
    /failed its checksum check/
  );
  assert.throws(
    () => readDownloadableArchive(buildArchive(baseManifest(), {})),
    /missing the database payload/
  );
});
