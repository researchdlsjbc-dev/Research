const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsePostgresUrl,
  buildPgEnv,
  assertBackupConnection,
  parseSchemaList,
  buildDumpArgs,
  buildRestoreArgs,
  assertSafeStagingTarget,
  quoteIdent
} = require('../scripts/lib/pgTools');

const ENV_KEYS = [
  'BACKUP_PG_SCHEMAS',
  'BACKUP_PG_DUMP_INCLUDE_OWNERS',
  'BACKUP_ALLOW_POOLER',
  'RESTORE_ALLOW_SAME_HOST',
  'RESTORE_ALLOW_PROD_NAME',
  'RESTORE_ALLOW_NON_STAGING'
];
const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function resetEnv() {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
}

test.after(resetEnv);

test('Postgres URLs are decoded without exposing credentials in args', () => {
  const info = parsePostgresUrl('postgresql://user%40name:p%40ss%2Fword@db.example.com:5432/research%20db?sslmode=require');
  assert.equal(info.host, 'db.example.com');
  assert.equal(info.port, '5432');
  assert.equal(info.user, 'user@name');
  assert.equal(info.password, 'p@ss/word');
  assert.equal(info.database, 'research db');
  assert.equal(info.sslmode, 'require');

  assert.equal(parsePostgresUrl('postgres://u:p@localhost/db').port, '5432');
  assert.throws(() => parsePostgresUrl('mysql://u:p@localhost/db'), /must use the postgres/);
  assert.throws(() => parsePostgresUrl(''), /is not set/);
});

test('PG environment forces SSL remotely and disables it locally', () => {
  const remote = buildPgEnv('postgresql://u:p@db.example.com:5432/db', {});
  assert.equal(remote.env.PGPASSWORD, 'p');
  assert.equal(remote.env.PGSSLMODE, 'require');
  const local = buildPgEnv('postgresql://u:p@localhost:5432/db', {});
  assert.equal(local.env.PGSSLMODE, 'disable');
});

test('dump args are safe by default and schema names are validated', () => {
  resetEnv();
  delete process.env.BACKUP_PG_SCHEMAS;
  delete process.env.BACKUP_PG_DUMP_INCLUDE_OWNERS;
  assert.deepEqual(parseSchemaList(), ['public']);

  const { args } = buildDumpArgs('postgresql://u:p@db.example.com:5432/app', 'out.dump', ['public']);
  assert.ok(args.includes('--format=custom'));
  assert.ok(args.includes('--compress=9'));
  assert.ok(args.includes('--no-owner'));
  assert.ok(args.includes('--no-privileges'));
  assert.ok(args.includes('--no-password'));
  assert.ok(args.includes('--schema'));
  assert.ok(!args.includes('p'));

  process.env.BACKUP_PG_SCHEMAS = 'public,app';
  assert.deepEqual(parseSchemaList(), ['public', 'app']);
  process.env.BACKUP_PG_SCHEMAS = '*';
  assert.throws(() => parseSchemaList(), /not supported/);
  process.env.BACKUP_PG_SCHEMAS = 'public;drop';
  assert.throws(() => parseSchemaList(), /Invalid schema name/);
});

test('Supabase transaction pooler is upgraded to the session pooler for pg_dump', () => {
  resetEnv();
  delete process.env.BACKUP_ALLOW_POOLER;
  const info = assertBackupConnection('postgresql://postgres.abc:p@aws-0-region.pooler.supabase.com:6543/postgres');
  assert.equal(info.port, '5432');
  const { args } = buildDumpArgs('postgresql://postgres.abc:p@aws-0-region.pooler.supabase.com:6543/postgres', 'out.dump', ['public']);
  assert.equal(args[args.indexOf('--port') + 1], '5432');
  process.env.BACKUP_ALLOW_POOLER = '1';
  assert.equal(assertBackupConnection('postgresql://postgres.abc:p@aws-0-region.pooler.supabase.com:6543/postgres').port, '6543');
});

test('non-Supabase transaction poolers are still refused for pg_dump', () => {
  resetEnv();
  delete process.env.BACKUP_ALLOW_POOLER;
  assert.throws(
    () => assertBackupConnection('postgresql://u:p@pooler.example.com:6543/postgres'),
    /transaction pooler/
  );
});

test('restore args are transactional and non-destructive outside the target', () => {
  const { args } = buildRestoreArgs('postgresql://u:p@staging.example:5432/researchhub_staging', 'restore.dump');
  assert.ok(args.includes('--clean'));
  assert.ok(args.includes('--if-exists'));
  assert.ok(args.includes('--exit-on-error'));
  assert.ok(args.includes('--single-transaction'));
  assert.ok(args.includes('--no-owner'));
  assert.ok(args.includes('--no-privileges'));
  assert.equal(args.at(-1), 'restore.dump');
});

test('staging safety rejects production-like targets', () => {
  resetEnv();
  delete process.env.RESTORE_ALLOW_SAME_HOST;
  delete process.env.RESTORE_ALLOW_PROD_NAME;
  delete process.env.RESTORE_ALLOW_NON_STAGING;

  const production = 'postgresql://u:p@prod.example.com:5432/researchhub';
  assert.throws(
    () => assertSafeStagingTarget(production, production),
    /same as the production/
  );
  assert.throws(
    () => assertSafeStagingTarget('postgresql://u:p@prod.example.com:5432/researchhub_staging', production),
    /same host/
  );
  assert.throws(
    () => assertSafeStagingTarget('postgresql://u:p@staging.example.com:5432/researchhub_prod', production),
    /contains "prod"/
  );
  assert.throws(
    () => assertSafeStagingTarget('postgresql://u:p@staging.example.com:5432/researchhub', production),
    /must contain staging/
  );
  assert.throws(
    () => assertSafeStagingTarget('postgresql://u:p@staging.example.com:6543/researchhub_staging', production),
    /transaction pooler/
  );

  const safe = assertSafeStagingTarget('postgresql://u:p@staging.example.com:5432/researchhub_staging', production);
  assert.equal(safe.staging.database, 'researchhub_staging');
});

test('staging safety rejects the same Supabase project across direct and pooled hosts', () => {
  resetEnv();
  delete process.env.RESTORE_ALLOW_SAME_HOST;

  const production = 'postgresql://postgres.prodref:p@aws-0-us-east-1.pooler.supabase.com:5432/postgres';
  const staging = 'postgresql://postgres:p@db.prodref.supabase.co:5432/researchhub_staging';

  assert.throws(
    () => assertSafeStagingTarget(staging, production),
    /same Supabase project/
  );

  process.env.RESTORE_ALLOW_SAME_HOST = '1';
  const safe = assertSafeStagingTarget(staging, production);
  assert.equal(safe.staging.database, 'researchhub_staging');
  assert.equal(safe.production.host, 'aws-0-us-east-1.pooler.supabase.com');
});

test('identifier quoting escapes double quotes', () => {
  assert.equal(quoteIdent('users'), '"users"');
  assert.equal(quoteIdent('weird"name'), '"weird""name"');
});
