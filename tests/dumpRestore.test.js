const test = require('node:test');
const assert = require('node:assert/strict');

const {
  quoteIdent,
  tableIdent,
  dumpDatabaseToJson,
  insertRows,
  resetSequences
} = require('../api/backup/dumpRestore');

test('tableIdent quotes the schema and table separately', () => {
  assert.equal(tableIdent('public', 'authors'), '"public"."authors"');
  assert.equal(tableIdent('public', 'weird"name'), '"public"."weird""name"');
  assert.notEqual(tableIdent('public', 'authors'), '"public.authors"');
});

test('quoteIdent escapes embedded double quotes', () => {
  assert.equal(quoteIdent('simple'), '"simple"');
  assert.equal(quoteIdent('a"b'), '"a""b"');
});

test('dumpDatabaseToJson uses qualified table identifiers', async () => {
  const queries = [];
  const fakeClient = {
    async query(sql) {
      queries.push(sql);
      if (sql.includes('FROM information_schema.tables')) {
        return { rows: [{ table_name: 'authors' }] };
      }
      if (sql.includes('FROM information_schema.columns')) {
        return { rows: [{ column_name: 'id' }, { column_name: 'name' }] };
      }
      if (sql.includes('SELECT * FROM')) {
        return { rows: [{ id: 1, name: 'Ada' }] };
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    }
  };

  const payload = await dumpDatabaseToJson(fakeClient);
  assert.equal(payload.app, 'ResearchHub');
  assert.equal(payload.tables.length, 1);
  assert.equal(payload.tables[0].name, 'authors');
  assert.deepEqual(payload.tables[0].rows, [{ id: 1, name: 'Ada' }]);
  assert.ok(queries.includes('SELECT * FROM "public"."authors"'));
});

test('insertRows uses qualified table and column identifiers', async () => {
  const calls = [];
  const fakeClient = {
    async query(sql, values) {
      calls.push({ sql, values });
      return { rows: [] };
    }
  };

  await insertRows(fakeClient, 'authors', ['id', 'name'], [
    { id: 1, name: 'Ada' },
    { id: 2, name: 'Grace' }
  ]);

  assert.equal(calls.length, 1);
  assert.ok(
    calls[0].sql.startsWith(
      'INSERT INTO "public"."authors" ("id", "name") OVERRIDING SYSTEM VALUE VALUES'
    ),
    calls[0].sql
  );
  assert.deepEqual(calls[0].values, [1, 'Ada', 2, 'Grace']);
});

test('resetSequences resolves sequences by qualified table name', async () => {
  const calls = [];
  const fakeClient = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.includes('pg_get_serial_sequence')) {
        return { rows: [{ column_name: 'id', seq_name: 'public.users_id_seq' }] };
      }
      return { rows: [] };
    }
  };

  await resetSequences(fakeClient, ['users']);

  assert.equal(calls.length, 2);
  assert.ok(
    calls[0].sql.includes("pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname)"),
    calls[0].sql
  );
  assert.ok(calls[1].sql.startsWith('SELECT setval($1::regclass'));
  assert.deepEqual(calls[1].params, ['public.users_id_seq']);
});
