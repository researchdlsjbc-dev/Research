require('dotenv').config();

const pool = require('../api/db');
const { safeErrorMessage } = require('../api/backup/errors');

async function main() {
  await pool.query('ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_path TEXT');
  await pool.query('ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_file_name TEXT');
  await pool.query('ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_size BIGINT');
  await pool.query('ALTER TABLE research ADD COLUMN IF NOT EXISTS pdf_content_type TEXT');

  const columns = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'research'
       AND column_name IN ('pdf_path', 'pdf_file_name', 'pdf_size', 'pdf_content_type')
     ORDER BY column_name`
  );
  console.log('Research PDF migration is applied.');
  console.log(`Columns: ${columns.rows.map((row) => row.column_name).join(', ')}`);
}

main()
  .catch((err) => {
    console.error('Research PDF migration failed:', safeErrorMessage(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
