function isSupabaseHost(host) {
  const value = String(host || '').toLowerCase();
  return value === 'pooler.supabase.com' ||
    value.endsWith('.pooler.supabase.com') ||
    value.endsWith('.supabase.co');
}

function normalizeBackupDatabaseUrl(raw, { allowPooler = process.env.BACKUP_ALLOW_POOLER === '1' } = {}) {
  if (!raw) return raw;
  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    return raw;
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) return raw;
  const port = parsed.port || '5432';
  if (port !== '6543' || allowPooler) return raw;
  if (!isSupabaseHost(parsed.hostname)) return raw;
  parsed.port = '5432';
  return parsed.toString();
}

module.exports = {
  isSupabaseHost,
  normalizeBackupDatabaseUrl
};
