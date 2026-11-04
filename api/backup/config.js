const { BackupError } = require('./errors');
const { normalizeBackupDatabaseUrl } = require('./databaseUrl');

const PRODUCTION_APP_URL = 'https://research-pi-ten.vercel.app';
const REDIRECT_PATH = '/api/auth/google/callback';
const DEFAULT_FOLDER_NAME = 'ResearchHub Backups';
const DEFAULT_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY_VERSION = 'v1';

function firstEnv(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && String(value).trim()) return String(value).trim();
  }
  return '';
}

function getAppUrl() {
  const configured = firstEnv('APP_URL', 'PUBLIC_APP_URL');
  if (configured) return configured.replace(/\/+$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`.replace(/\/+$/, '');
  return PRODUCTION_APP_URL;
}

function getRedirectUri() {
  return firstEnv('GOOGLE_REDIRECT_URI') || `${getAppUrl()}${REDIRECT_PATH}`;
}

function getGoogleScopes() {
  const configured = firstEnv('GOOGLE_OAUTH_SCOPES');
  if (!configured) return [DEFAULT_SCOPE];
  return configured.split(/\s+/).filter(Boolean);
}

function getConfig() {
  return {
    appUrl: getAppUrl(),
    redirectUri: getRedirectUri(),
    clientId: firstEnv('GOOGLE_CLIENT_ID'),
    clientSecret: firstEnv('GOOGLE_CLIENT_SECRET'),
    scopes: getGoogleScopes(),
    folderName: firstEnv('GOOGLE_DRIVE_FOLDER_NAME') || DEFAULT_FOLDER_NAME,
    encryptionKey: firstEnv('BACKUP_ENCRYPTION_KEY'),
    cronSecret: firstEnv('CRON_SECRET'),
    alertWebhookUrl: firstEnv('BACKUP_ALERT_WEBHOOK_URL'),
    alertWebhookToken: firstEnv('BACKUP_ALERT_WEBHOOK_TOKEN'),
    triggerWebhookUrl: firstEnv('BACKUP_TRIGGER_WEBHOOK_URL'),
    triggerWebhookToken: firstEnv('BACKUP_TRIGGER_WEBHOOK_TOKEN'),
    supabaseUrl: firstEnv('SUPABASE_URL'),
    supabaseServiceKey: firstEnv('SUPABASE_SERVICE_ROLE_KEY'),
    storageBucket: firstEnv('SUPABASE_STORAGE_BUCKET'),
    stagingDatabaseUrl: firstEnv('RESTORE_STAGING_DATABASE_URL'),
    backupDatabaseUrl: normalizeBackupDatabaseUrl(firstEnv('BACKUP_DATABASE_URL', 'DATABASE_URL')),
    productionDatabaseUrl: normalizeBackupDatabaseUrl(firstEnv('DATABASE_URL', 'BACKUP_DATABASE_URL')),
    tokenKeyVersion: TOKEN_KEY_VERSION
  };
}

function missingGoogleConfig(config = getConfig()) {
  const missing = [];
  if (!config.clientId) missing.push('GOOGLE_CLIENT_ID');
  if (!config.clientSecret) missing.push('GOOGLE_CLIENT_SECRET');
  if (!config.redirectUri) missing.push('GOOGLE_REDIRECT_URI');
  return missing;
}

function assertGoogleConfigured(config = getConfig()) {
  const missing = missingGoogleConfig(config);
  if (missing.length) {
    throw new BackupError(
      `Google Drive is not configured. Missing: ${missing.join(', ')}`,
      { status: 503, code: 'GOOGLE_NOT_CONFIGURED' }
    );
  }
  return config;
}

function assertEncryptionConfigured(config = getConfig()) {
  if (!config.encryptionKey) {
    throw new BackupError(
      'BACKUP_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32',
      { status: 503, code: 'ENCRYPTION_NOT_CONFIGURED' }
    );
  }
  return config;
}

function isStorageConfigured(config = getConfig()) {
  return Boolean(config.supabaseUrl && config.supabaseServiceKey && config.storageBucket);
}

function isGoogleConfigured(config = getConfig()) {
  return missingGoogleConfig(config).length === 0;
}

function isEncryptionConfigured(config = getConfig()) {
  return Boolean(config.encryptionKey);
}

module.exports = {
  PRODUCTION_APP_URL,
  REDIRECT_PATH,
  DEFAULT_FOLDER_NAME,
  DEFAULT_SCOPE,
  TOKEN_KEY_VERSION,
  getConfig,
  getAppUrl,
  getRedirectUri,
  getGoogleScopes,
  missingGoogleConfig,
  assertGoogleConfigured,
  assertEncryptionConfigured,
  isStorageConfigured,
  isGoogleConfigured,
  isEncryptionConfigured
};
