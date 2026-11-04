require('dotenv').config();

const pool = require('../api/db');
const { safeErrorMessage } = require('../api/backup/errors');
const { generateAccessCode } = require('../api/researchAccess');

async function applySchema() {
  await pool.query('ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_access_code TEXT');
  await pool.query('ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_access_code_updated_at TIMESTAMPTZ');
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_research_pdf_access_code
       ON research (pdf_access_code)
       WHERE pdf_access_code IS NOT NULL`
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS research_pdf_access_attempts (
       id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       research_id BIGINT NOT NULL REFERENCES research(id) ON DELETE CASCADE,
       ip_hash     TEXT NOT NULL,
       successful  BOOLEAN NOT NULL DEFAULT false,
       created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_research_pdf_attempts_lookup
       ON research_pdf_access_attempts (research_id, ip_hash, created_at DESC)`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_research_pdf_attempts_created
       ON research_pdf_access_attempts (created_at)`
  );
}

async function backfillCodes() {
  const { rows } = await pool.query(
    'SELECT id FROM research WHERE pdf_access_code IS NULL ORDER BY id'
  );
  let updated = 0;
  for (const row of rows) {
    let saved = false;
    for (let attempt = 0; attempt < 10 && !saved; attempt += 1) {
      try {
        await pool.query(
          `UPDATE research
           SET pdf_access_code = $1, pdf_access_code_updated_at = now()
           WHERE id = $2 AND pdf_access_code IS NULL`,
          [generateAccessCode(), row.id]
        );
        saved = true;
        updated += 1;
      } catch (err) {
        if (!err || err.code !== '23505') throw err;
      }
    }
    if (!saved) throw new Error(`Unable to generate a unique access code for research ${row.id}.`);
  }
  return updated;
}

async function main() {
  await applySchema();
  const updated = await backfillCodes();
  const remaining = await pool.query(
    'SELECT COUNT(*)::int AS count FROM research WHERE pdf_access_code IS NULL'
  );
  console.log('Research PDF access migration is applied.');
  console.log(`Backfilled access codes for ${updated} research record(s).`);
  console.log(`Research records still missing a code: ${remaining.rows[0].count}.`);
}

main()
  .catch((err) => {
    console.error('Research PDF access migration failed:', safeErrorMessage(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
