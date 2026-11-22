require('dotenv').config();

const pool = require('../api/db');

async function main() {
  await pool.query('ALTER TABLE research ADD COLUMN IF NOT EXISTS view_count BIGINT NOT NULL DEFAULT 0');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_research_view_count ON research (view_count DESC)');

  const columns = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'research'
       AND column_name = 'view_count'`
  );
  console.log('Research views migration is applied.');
  console.log(`Columns: ${columns.rows.map((row) => row.column_name).join(', ')}`);
}

main()
  .catch((err) => {
    console.error('Research views migration failed:', err && err.message ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
