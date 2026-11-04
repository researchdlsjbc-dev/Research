const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ACCESS_CODE_ALPHABET,
  ACCESS_CODE_LENGTH,
  normalizeAccessCode,
  formatAccessCode,
  isValidAccessCodeFormat,
  generateAccessCode,
  accessCodesMatch,
  getClientIp,
  hashClientIp
} = require('../api/researchAccess');

test('generated access codes use the unambiguous alphabet and are grouped', () => {
  for (let i = 0; i < 100; i += 1) {
    const code = generateAccessCode();
    assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const normalized = normalizeAccessCode(code);
    assert.equal(normalized.length, ACCESS_CODE_LENGTH);
    assert.equal([...normalized].every((character) => ACCESS_CODE_ALPHABET.includes(character)), true);
    assert.equal(isValidAccessCodeFormat(code), true);
    assert.equal(formatAccessCode(normalized), code);
  }
});

test('access codes normalize case, spaces, and separators', () => {
  assert.equal(normalizeAccessCode(' abcd-efgh '), 'ABCDEFGH');
  assert.equal(formatAccessCode('ABCDEFGH'), 'ABCD-EFGH');
  assert.equal(accessCodesMatch('abcd efgh', 'ABCD-EFGH'), true);
  assert.equal(accessCodesMatch('ABCD-EFGI', 'ABCD-EFGH'), false);
});

test('invalid access code formats are rejected', () => {
  assert.equal(isValidAccessCodeFormat('ABCD-EFG'), false);
  assert.equal(isValidAccessCodeFormat('ABCD-EFGI'), false);
  assert.equal(isValidAccessCodeFormat('ABCD-EFG0'), false);
  assert.equal(isValidAccessCodeFormat(''), false);
});

test('client IP extraction prefers the first forwarded address', () => {
  assert.equal(getClientIp({ headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, socket: {} }), '203.0.113.7');
  assert.equal(getClientIp({ headers: { 'x-real-ip': '198.51.100.2' }, socket: {} }), '198.51.100.2');
  assert.equal(getClientIp({ headers: {}, socket: { remoteAddress: '127.0.0.1' } }), '127.0.0.1');
});

test('client IP hashing is stable and keyed', () => {
  const first = hashClientIp('203.0.113.7', 'secret-a');
  assert.equal(first, hashClientIp('203.0.113.7', 'secret-a'));
  assert.notEqual(first, hashClientIp('203.0.113.7', 'secret-b'));
  assert.match(first, /^[a-f0-9]{64}$/);
});
