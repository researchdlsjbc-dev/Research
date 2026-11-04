const crypto = require('crypto');

const PDF_PREFIX = 'pdfs';
const PDF_MIME_TYPE = 'application/pdf';
const MAX_PDF_BYTES = 50 * 1024 * 1024;

function sanitizeCode(code) {
  return String(code || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '') || 'research';
}

function sanitizePdfFileName(name) {
  const base = String(name || '')
    .split(/[\\/]/)
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  const safe = base
    .replace(/[^A-Za-z0-9._ ()\-]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim();
  const withoutExtension = safe.replace(/\.pdf$/i, '').replace(/[.\s]+$/g, '').slice(0, 150);
  return `${withoutExtension || 'document'}.pdf`;
}

function validatePdfUpload({ fileName, contentType, size } = {}) {
  if (!fileName || typeof fileName !== 'string' || !/\.pdf$/i.test(fileName.trim())) {
    return { ok: false, error: 'Only PDF files are allowed.' };
  }
  const type = String(contentType || '').toLowerCase();
  if (type && type !== PDF_MIME_TYPE && type !== 'application/octet-stream') {
    return { ok: false, error: 'Only PDF files are allowed.' };
  }
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return { ok: false, error: 'The selected PDF is empty.' };
  }
  if (bytes > MAX_PDF_BYTES) {
    return { ok: false, error: `PDF files must be ${Math.round(MAX_PDF_BYTES / (1024 * 1024))} MB or smaller.` };
  }
  return { ok: true };
}

function pdfFolderForCode(code) {
  return `${PDF_PREFIX}/${sanitizeCode(code)}`;
}

function buildPdfObjectPath(code, fileName, unique = crypto.randomUUID()) {
  const token = String(unique).replace(/[^A-Za-z0-9-]/g, '').slice(0, 12) || Date.now().toString(36);
  return `${pdfFolderForCode(code)}/${Date.now()}-${token}-${sanitizePdfFileName(fileName)}`;
}

function validatePdfObjectPath(objectPath, code) {
  const value = String(objectPath || '');
  if (!value || value.startsWith('/') || value.includes('..') || value.includes('\\')) {
    return { ok: false, error: 'Invalid PDF path.' };
  }
  const folder = `${pdfFolderForCode(code)}/`;
  if (!value.startsWith(folder) || !/\.pdf$/i.test(value)) {
    return { ok: false, error: 'Invalid PDF path.' };
  }
  return { ok: true, path: value };
}

module.exports = {
  PDF_PREFIX,
  PDF_MIME_TYPE,
  MAX_PDF_BYTES,
  sanitizeCode,
  sanitizePdfFileName,
  validatePdfUpload,
  pdfFolderForCode,
  buildPdfObjectPath,
  validatePdfObjectPath
};
