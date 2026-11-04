const express = require('express');
const pool = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  storageConfig,
  createSignedUploadUrl,
  createSignedDownloadUrl,
  deleteObject,
  objectExists
} = require('../../scripts/lib/supabaseStorage');
const {
  PDF_MIME_TYPE,
  sanitizePdfFileName,
  validatePdfUpload,
  buildPdfObjectPath,
  validatePdfObjectPath
} = require('../researchPdf');

const router = express.Router();

const SELECT_FIELDS = `r.id::int AS id, r.code, r.title, r.authors, r.adviser,
         r.program_id, r.year,
         r.abstract, r.keywords, r.submitted_by, r.status, r.created_at`;

const SELECT_FROM = `p.name AS program_name, p.code AS program_code,
         u.full_name AS submitted_by_name,
         COALESCE(
           json_agg(
             json_build_object(
               'id', a.id,
               'name', a.name,
               'email', a.email,
               'affiliation', a.affiliation,
               'orcid', a.orcid,
               'author_order', ra.author_order,
               'is_corresponding', ra.is_corresponding
             )
           ) FILTER (WHERE a.id IS NOT NULL),
           '[]'
         ) AS author_details
   FROM research r
   LEFT JOIN programs p ON p.id = r.program_id
   LEFT JOIN users u ON u.id = r.submitted_by
   LEFT JOIN research_authors ra ON ra.research_id = r.id
   LEFT JOIN authors a ON a.id = ra.author_id`;

const GROUP_BY = `GROUP BY r.id, p.name, p.code, u.full_name`;

let featuredSupported;
let pdfSupported;

async function loadSchema() {
  if (featuredSupported !== undefined && pdfSupported !== undefined) return;
  try {
    const r = await pool.query(
      `SELECT
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = current_schema()
             AND table_name = 'research'
             AND column_name = 'is_featured'
         ) AS featured_present,
         EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = current_schema()
             AND table_name = 'research'
             AND column_name = 'pdf_path'
         ) AS pdf_present`
    );
    featuredSupported = Boolean(r.rows[0] && r.rows[0].featured_present);
    pdfSupported = Boolean(r.rows[0] && r.rows[0].pdf_present);
  } catch (err) {
    console.error('[api/research] schema check failed, assuming optional columns do NOT exist:', err && err.message ? err.message : err);
    featuredSupported = false;
    pdfSupported = false;
  }
}

async function getSelect() {
  await loadSchema();
  const featuredField = featuredSupported
    ? 'COALESCE(r.is_featured, false) AS is_featured'
    : 'false AS is_featured';
  const pdfFields = pdfSupported
    ? `r.pdf_path, r.pdf_file_name, r.pdf_size::int AS pdf_size, r.pdf_content_type`
    : `NULL::text AS pdf_path, NULL::text AS pdf_file_name, NULL::int AS pdf_size, NULL::text AS pdf_content_type`;
  return {
    fields: `SELECT ${SELECT_FIELDS}, ${featuredField}, ${pdfFields}, ${SELECT_FROM}`,
    groupBy: GROUP_BY
  };
}

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function sendResearchError(res, err, context = 'request') {
  const status = Number.isInteger(err && err.status) ? err.status : 500;
  if (status >= 500) {
    console.error(`[api/research] ${context} failed:`, err && err.message ? err.message : err);
  }
  const body = { error: status >= 500 ? 'Server error' : err.message };
  if (err && err.code) body.code = err.code;
  res.status(status).json(body);
}

async function loadPdfTarget(id, user) {
  const extra = pdfSupported ? ', pdf_path, pdf_file_name, pdf_size, pdf_content_type' : '';
  const { rows } = await pool.query(`SELECT id, code, submitted_by${extra} FROM research WHERE id = $1`, [id]);
  const row = rows[0];
  if (!row) throw httpError(404, 'Not found', 'NOT_FOUND');
  if (user.role !== 'admin' && String(row.submitted_by) !== String(user.id)) {
    throw httpError(403, 'Not authorized', 'NOT_AUTHORIZED');
  }
  return row;
}

const TRUTHY = ['1', 'true', 'yes', 'on'];

function whereFromQuery(q, values, withFeatured = true) {
  const conds = [];
  const push = (cond) => conds.push(cond);

  const reqStatus = q.status || 'approved';
  if (reqStatus === 'all') {
    // No status filter - show all
  } else if (['approved', 'pending', 'rejected'].includes(reqStatus)) { values.push(reqStatus); push(`r.status = $${values.length}`); }
  else { values.push('approved'); push(`r.status = $${values.length}`); }

  if (TRUTHY.includes(String(q.featured).toLowerCase())) {
    // Without the column nothing can be featured, so return an honest empty
    // set instead of silently dropping the filter and labelling every row.
    if (withFeatured) push('COALESCE(r.is_featured, false) = true');
    else push('FALSE');
  }
  if (q.search) { values.push(`%${q.search}%`); push(`(r.title ILIKE $${values.length} OR r.authors ILIKE $${values.length} OR r.code ILIKE $${values.length} OR r.keywords ILIKE $${values.length} OR r.abstract ILIKE $${values.length})`); }
  if (q.code) { values.push(`%${q.code}%`); push(`r.code ILIKE $${values.length}`); }
  if (q.title) { values.push(`%${q.title}%`); push(`r.title ILIKE $${values.length}`); }
  if (q.author) { values.push(`%${q.author}%`); push(`r.authors ILIKE $${values.length}`); }
  if (q.program) { values.push(q.program); push(`r.program_id = (SELECT id FROM programs WHERE code = $${values.length})`); }
  if (q.year) { values.push(parseInt(q.year)); push(`r.year = $${values.length}`); }

  return conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
}

router.get('/', async (req, res) => {
  try {
    const SELECT = await getSelect();
    const values = [];
    const where = whereFromQuery(req.query, values, featuredSupported);
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const total = await pool.query(`SELECT COUNT(*)::int AS total FROM research r${where}`, values);
    values.push(limit, (page - 1) * limit);
    const { rows } = await pool.query(`${SELECT.fields}${where} ${SELECT.groupBy} ORDER BY r.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
    res.json({ data: rows, total: total.rows[0].total, page, pages: Math.ceil(total.rows[0].total / limit) });
  } catch (err) {
    console.error('[api/research] request failed:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/all', authenticateToken, async (req, res) => {
  const values = [];
  const conds = [];
  if (req.query.status) { values.push(req.query.status); conds.push(`r.status = $${values.length}`); }
  if (req.query.search) { values.push(`%${req.query.search}%`); conds.push(`(r.title ILIKE $${values.length} OR r.authors ILIKE $${values.length} OR r.code ILIKE $${values.length})`); }
  try {
    const SELECT = await getSelect();
    if (TRUTHY.includes(String(req.query.featured).toLowerCase())) {
      if (featuredSupported) conds.push('COALESCE(r.is_featured, false) = true');
      else conds.push('FALSE');
    }
    const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
    const { rows } = await pool.query(`${SELECT.fields}${where} ${SELECT.groupBy} ORDER BY r.created_at DESC`, values);
    res.json(rows);
  } catch (err) {
    console.error('[api/research] request failed:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    await loadSchema();
    if (!pdfSupported) return res.status(404).json({ error: 'No PDF is attached to this research.', code: 'PDF_NOT_FOUND' });
    const { rows } = await pool.query('SELECT id, pdf_path, pdf_file_name FROM research WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
    if (!rows[0].pdf_path) return res.status(404).json({ error: 'No PDF is attached to this research.', code: 'PDF_NOT_FOUND' });
    const fileName = rows[0].pdf_file_name || 'research.pdf';
    const url = await createSignedDownloadUrl(storageConfig(), rows[0].pdf_path, 60, fileName);
    if (!url) throw httpError(502, 'Unable to create a download link.', 'PDF_DOWNLOAD_LINK_FAILED');
    res.json({ url, file_name: fileName, expires_in: 60 });
  } catch (err) {
    sendResearchError(res, err, 'PDF download');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const SELECT = await getSelect();
    const { rows } = await pool.query(`${SELECT.fields} WHERE r.id = $1 ${SELECT.groupBy}`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('[api/research] request failed:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  const { title, authors, author_ids, adviser, program_id, year, abstract, keywords } = req.body;
  if (!title || (!authors && !author_ids) || !year) return res.status(400).json({ error: 'Required fields missing' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const codeYear = String(new Date().getFullYear());
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`research_code_${codeYear}`]);
    const sequence = await client.query(
      `SELECT COALESCE(MAX(split_part(code, '-', 3)::int), 0)::int AS max_seq
       FROM research
       WHERE code ~ ('^RS-' || $1::text || '-[0-9]+$')`,
      [codeYear]
    );
    const code = `RS-${codeYear}-${String(sequence.rows[0].max_seq + 1).padStart(4, '0')}`;
    const { rows } = await client.query(
      `INSERT INTO research (code, title, authors, adviser, program_id, year, abstract, keywords, submitted_by, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id::int AS id, code, title, authors, adviser, program_id, year, abstract, keywords, submitted_by, status, created_at`,
      [code, title, authors, adviser || null, program_id ? parseInt(program_id) : null, parseInt(year), abstract || '', keywords || '', req.user.id, req.user.role === 'admin' ? 'approved' : 'pending']
    );
    const research = rows[0];
    
    // Handle author associations
    if (author_ids && Array.isArray(author_ids) && author_ids.length > 0) {
      for (let i = 0; i < author_ids.length; i++) {
        await client.query(
          `INSERT INTO research_authors (research_id, author_id, author_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (research_id, author_id) DO NOTHING`,
          [research.id, author_ids[i], i + 1]
        );
      }
    } else if (authors) {
      // Legacy: create/update authors from comma-separated string
      const authorNames = authors.split(',').map(n => n.trim()).filter(n => n);
      for (let i = 0; i < authorNames.length; i++) {
        const authorResult = await client.query(
          `INSERT INTO authors (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [authorNames[i]]
        );
        await client.query(
          `INSERT INTO research_authors (research_id, author_id, author_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (research_id, author_id) DO NOTHING`,
          [research.id, authorResult.rows[0].id, i + 1]
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Return with author details
    const SELECT = await getSelect();
    const { rows: finalRows } = await client.query(`${SELECT.fields} WHERE r.id = $1 ${SELECT.groupBy}`, [research.id]);
    res.json(finalRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[api/research] request failed:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.put('/:id', authenticateToken, async (req, res) => {
  const { title, authors, author_ids, adviser, program_id, year, abstract, keywords } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT * FROM research WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Not found' });
    const cur = existing.rows[0];
    if (req.user.role !== 'admin' && String(cur.submitted_by) !== String(req.user.id)) return res.status(403).json({ error: 'Not authorized' });

    const { rows } = await client.query(
      `UPDATE research SET title=$1, authors=$2, adviser=$3, program_id=$4, year=$5, abstract=$6, keywords=$7
       WHERE id=$8 RETURNING id::int AS id, code, title, authors, adviser, program_id, year, abstract, keywords, submitted_by, status, created_at`,
      [title || cur.title, authors || cur.authors, adviser !== undefined ? adviser : cur.adviser, program_id ? parseInt(program_id) : cur.program_id, year ? parseInt(year) : cur.year, abstract !== undefined ? abstract : cur.abstract, keywords !== undefined ? keywords : cur.keywords, req.params.id]
    );
    const research = rows[0];

    // Handle author associations if provided
    if (author_ids && Array.isArray(author_ids)) {
      // Remove existing associations
      await client.query('DELETE FROM research_authors WHERE research_id = $1', [research.id]);
      // Add new associations
      for (let i = 0; i < author_ids.length; i++) {
        await client.query(
          `INSERT INTO research_authors (research_id, author_id, author_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (research_id, author_id) DO NOTHING`,
          [research.id, author_ids[i], i + 1]
        );
      }
    } else if (authors !== undefined && authors !== cur.authors) {
      // Legacy: update from comma-separated string
      await client.query('DELETE FROM research_authors WHERE research_id = $1', [research.id]);
      const authorNames = authors.split(',').map(n => n.trim()).filter(n => n);
      for (let i = 0; i < authorNames.length; i++) {
        const authorResult = await client.query(
          `INSERT INTO authors (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [authorNames[i]]
        );
        await client.query(
          `INSERT INTO research_authors (research_id, author_id, author_order)
           VALUES ($1, $2, $3)
           ON CONFLICT (research_id, author_id) DO NOTHING`,
          [research.id, authorResult.rows[0].id, i + 1]
        );
      }
    }

    await client.query('COMMIT');
    
    // Return with author details
    const SELECT = await getSelect();
    const { rows: finalRows } = await client.query(`${SELECT.fields} WHERE r.id = $1 ${SELECT.groupBy}`, [research.id]);
    res.json(finalRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[api/research] request failed:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

router.post('/:id/pdf/upload-url', authenticateToken, async (req, res) => {
  try {
    await loadSchema();
    if (!pdfSupported) {
      return res.status(409).json({ error: 'PDF attachments are unavailable until the research PDF migration is applied.', code: 'PDF_MIGRATION_REQUIRED' });
    }
    const target = await loadPdfTarget(req.params.id, req.user);
    const body = req.body || {};
    const validation = validatePdfUpload({ fileName: body.file_name, contentType: body.content_type, size: body.size });
    if (!validation.ok) return res.status(400).json({ error: validation.error, code: 'INVALID_PDF' });
    const fileName = sanitizePdfFileName(body.file_name);
    const objectPath = buildPdfObjectPath(target.code, fileName);
    const signed = await createSignedUploadUrl(storageConfig(), objectPath);
    if (!signed.uploadUrl) throw httpError(502, 'Unable to create an upload link.', 'PDF_UPLOAD_LINK_FAILED');
    res.json({
      upload_url: signed.uploadUrl,
      path: objectPath,
      file_name: fileName,
      expires_in: 7200
    });
  } catch (err) {
    sendResearchError(res, err, 'PDF upload URL');
  }
});

router.post('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    await loadSchema();
    if (!pdfSupported) {
      return res.status(409).json({ error: 'PDF attachments are unavailable until the research PDF migration is applied.', code: 'PDF_MIGRATION_REQUIRED' });
    }
    const target = await loadPdfTarget(req.params.id, req.user);
    const body = req.body || {};
    const pathCheck = validatePdfObjectPath(body.path, target.code);
    if (!pathCheck.ok) return res.status(400).json({ error: pathCheck.error, code: 'INVALID_PDF_PATH' });
    const fileName = sanitizePdfFileName(body.file_name || pathCheck.path);
    const validation = validatePdfUpload({ fileName, contentType: body.content_type, size: body.size });
    if (!validation.ok) return res.status(400).json({ error: validation.error, code: 'INVALID_PDF' });

    const config = storageConfig();
    const exists = await objectExists(config, pathCheck.path);
    if (!exists) return res.status(409).json({ error: 'The PDF upload did not complete. Please try again.', code: 'PDF_UPLOAD_MISSING' });

    const oldPath = target.pdf_path && target.pdf_path !== pathCheck.path ? target.pdf_path : null;
    await pool.query(
      `UPDATE research
       SET pdf_path = $1, pdf_file_name = $2, pdf_size = $3, pdf_content_type = $4
       WHERE id = $5`,
      [pathCheck.path, fileName, Number(body.size), PDF_MIME_TYPE, req.params.id]
    );
    if (oldPath) await deleteObject(config, oldPath).catch((err) => console.warn('[api/research] old PDF cleanup failed:', err && err.message ? err.message : err));

    const SELECT = await getSelect();
    const { rows } = await pool.query(`${SELECT.fields} WHERE r.id = $1 ${SELECT.groupBy}`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    sendResearchError(res, err, 'PDF attach');
  }
});

router.delete('/:id/pdf', authenticateToken, async (req, res) => {
  try {
    await loadSchema();
    if (!pdfSupported) {
      return res.status(409).json({ error: 'PDF attachments are unavailable until the research PDF migration is applied.', code: 'PDF_MIGRATION_REQUIRED' });
    }
    const target = await loadPdfTarget(req.params.id, req.user);
    if (target.pdf_path) {
      await deleteObject(storageConfig(), target.pdf_path).catch((err) => console.warn('[api/research] PDF cleanup failed:', err && err.message ? err.message : err));
    }
    await pool.query(
      'UPDATE research SET pdf_path = NULL, pdf_file_name = NULL, pdf_size = NULL, pdf_content_type = NULL WHERE id = $1',
      [req.params.id]
    );
    res.json({ message: 'PDF removed' });
  } catch (err) {
    sendResearchError(res, err, 'PDF remove');
  }
});

router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'pending', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    const updated = await pool.query('UPDATE research SET status = $1 WHERE id = $2 RETURNING id', [status, req.params.id]);
    if (!updated.rows[0]) return res.status(404).json({ error: 'Not found' });
    const SELECT = await getSelect();
    const { rows } = await pool.query(`${SELECT} WHERE r.id = $1`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[api/research] request failed:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/featured', authenticateToken, requireAdmin, async (req, res) => {
  const featured = req.body.is_featured;
  const next = typeof featured === 'string' ? TRUTHY.includes(featured.toLowerCase()) : Boolean(featured);
  try {
    const SELECT = await getSelect();
    if (!featuredSupported) {
      return res.status(409).json({ error: 'Featured books are unavailable until the is_featured migration is applied' });
    }
    const updated = await pool.query('UPDATE research SET is_featured = $1 WHERE id = $2 RETURNING id', [next, req.params.id]);
    if (!updated.rows[0]) return res.status(404).json({ error: 'Not found' });
    const { rows } = await pool.query(`${SELECT} WHERE r.id = $1`, [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('[api/research] request failed:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM research WHERE id = $1', [req.params.id]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Not found' });
    const cur = existing.rows[0];
    if (req.user.role !== 'admin' && String(cur.submitted_by) !== String(req.user.id)) return res.status(403).json({ error: 'Not authorized' });
    if (cur.pdf_path) {
      await deleteObject(storageConfig(), cur.pdf_path).catch((err) => console.warn('[api/research] PDF cleanup failed:', err && err.message ? err.message : err));
    }
    await pool.query('DELETE FROM research_authors WHERE research_id = $1', [req.params.id]);
    await pool.query('DELETE FROM research WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[api/research] request failed:', err && err.message ? err.message : err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;