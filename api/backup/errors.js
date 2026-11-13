class BackupError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'BackupError';
    this.status = options.status || 500;
    this.code = options.code || 'BACKUP_ERROR';
    this.details = options.details;
    this.retryable = options.retryable === true;
  }
}

const SECRET_PATTERNS = [
  /ya29\.[A-Za-z0-9._-]+/g,
  /1\/\/[A-Za-z0-9._-]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi
];

function redact(value) {
  let text = typeof value === 'string' ? value : String(value || '');
  for (const pattern of SECRET_PATTERNS) text = text.replace(pattern, '[redacted]');
  return text.slice(0, 2000);
}

function safeErrorMessage(err) {
  if (!err) return 'Unknown error';
  if (err instanceof BackupError) return redact(err.message);
  return redact(err.message || err);
}

function toPublicError(err) {
  if (err instanceof BackupError) {
    return {
      status: err.status,
      body: { error: err.message, code: err.code, ...(err.details ? { details: err.details } : {}) }
    };
  }
  console.error(
    '[backup] unexpected error:',
    safeErrorMessage(err),
    err && err.code ? `(code: ${err.code})` : ''
  );
  return { status: 500, body: { error: 'Server error', code: 'INTERNAL_ERROR' } };
}

module.exports = { BackupError, safeErrorMessage, redact, toPublicError };
