const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PDF_MIME_TYPE,
  MAX_PDF_BYTES,
  sanitizeCode,
  sanitizePdfFileName,
  validatePdfUpload,
  buildPdfObjectPath,
  validatePdfObjectPath
} = require('../api/researchPdf');

test('sanitizePdfFileName strips paths and forces a .pdf extension', () => {
  assert.equal(sanitizePdfFileName('../../thesis final.pdf'), 'thesis final.pdf');
  assert.equal(sanitizePdfFileName('C:\\Users\\Admin\\Thesis.PDF'), 'Thesis.pdf');
  assert.equal(sanitizePdfFileName('report'), 'report.pdf');
  assert.equal(sanitizePdfFileName(''), 'document.pdf');
});

test('sanitizeCode keeps storage folder names safe', () => {
  assert.equal(sanitizeCode('RS-2026-0001'), 'RS-2026-0001');
  assert.equal(sanitizeCode('../../etc/passwd'), 'etc-passwd');
  assert.equal(sanitizeCode(''), 'research');
});

test('validatePdfUpload accepts a PDF and rejects other files', () => {
  assert.deepEqual(validatePdfUpload({ fileName: 'study.pdf', contentType: PDF_MIME_TYPE, size: 1024 }), { ok: true });
  assert.deepEqual(validatePdfUpload({ fileName: 'study.pdf', contentType: 'application/octet-stream', size: 1024 }), { ok: true });
  assert.equal(validatePdfUpload({ fileName: 'study.docx', contentType: 'application/msword', size: 1024 }).ok, false);
  assert.equal(validatePdfUpload({ fileName: 'study.pdf', contentType: 'image/png', size: 1024 }).ok, false);
  assert.equal(validatePdfUpload({ fileName: 'study.pdf', contentType: PDF_MIME_TYPE, size: 0 }).ok, false);
  assert.equal(validatePdfUpload({ fileName: 'study.pdf', contentType: PDF_MIME_TYPE, size: MAX_PDF_BYTES + 1 }).ok, false);
});

test('buildPdfObjectPath puts files in a per-research folder under pdfs/', () => {
  const path = buildPdfObjectPath('RS-2026-0001', 'My Thesis.pdf', 'abc123');
  assert.match(path, /^pdfs\/RS-2026-0001\/\d+-abc123-My Thesis\.pdf$/);
});

test('validatePdfObjectPath only allows paths inside the research folder', () => {
  assert.equal(validatePdfObjectPath('pdfs/RS-2026-0001/file.pdf', 'RS-2026-0001').ok, true);
  assert.equal(validatePdfObjectPath('pdfs/RS-2026-0002/file.pdf', 'RS-2026-0001').ok, false);
  assert.equal(validatePdfObjectPath('pdfs/RS-2026-0001/../../secret.pdf', 'RS-2026-0001').ok, false);
  assert.equal(validatePdfObjectPath('/pdfs/RS-2026-0001/file.pdf', 'RS-2026-0001').ok, false);
  assert.equal(validatePdfObjectPath('pdfs/RS-2026-0001/file.txt', 'RS-2026-0001').ok, false);
});
