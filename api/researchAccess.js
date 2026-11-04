const crypto = require('crypto');

const ACCESS_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACCESS_CODE_LENGTH = 8;
const ACCESS_CODE_GROUP_SIZE = 4;

function normalizeAccessCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function formatAccessCode(value) {
  const normalized = normalizeAccessCode(value);
  if (normalized.length !== ACCESS_CODE_LENGTH) return normalized;
  return `${normalized.slice(0, ACCESS_CODE_GROUP_SIZE)}-${normalized.slice(ACCESS_CODE_GROUP_SIZE)}`;
}

function isValidAccessCodeFormat(value) {
  const normalized = normalizeAccessCode(value);
  return normalized.length === ACCESS_CODE_LENGTH
    && [...normalized].every((character) => ACCESS_CODE_ALPHABET.includes(character));
}

function generateAccessCode() {
  let normalized = '';
  for (let i = 0; i < ACCESS_CODE_LENGTH; i += 1) {
    normalized += ACCESS_CODE_ALPHABET[crypto.randomInt(0, ACCESS_CODE_ALPHABET.length)];
  }
  return formatAccessCode(normalized);
}

function accessCodesMatch(input, stored) {
  const left = normalizeAccessCode(input);
  const right = normalizeAccessCode(stored);
  if (!left || !right || left.length !== right.length) return false;
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function getClientIp(req) {
  const forwarded = req && req.headers ? req.headers['x-forwarded-for'] : '';
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || '').split(',')[0];
  const candidates = [
    firstForwarded,
    req && req.headers ? req.headers['x-real-ip'] : '',
    req && req.socket ? req.socket.remoteAddress : ''
  ];
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value) return value;
  }
  return 'unknown';
}

function hashClientIp(ip, secret) {
  return crypto
    .createHmac('sha256', String(secret || 'researchhub'))
    .update(String(ip || 'unknown'))
    .digest('hex');
}

module.exports = {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_LENGTH,
  ACCESS_CODE_GROUP_SIZE,
  normalizeAccessCode,
  formatAccessCode,
  isValidAccessCodeFormat,
  generateAccessCode,
  accessCodesMatch,
  getClientIp,
  hashClientIp
};
