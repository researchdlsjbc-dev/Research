const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const { getConfig, isStorageConfigured } = require('../../api/backup/config');
const { BackupError, safeErrorMessage } = require('../../api/backup/errors');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function storageConfig() {
  const config = getConfig();
  if (!isStorageConfigured(config)) {
    throw new BackupError(
      'Supabase Storage is not configured. Set SUPABASE_URL and a secret key (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY). SUPABASE_STORAGE_BUCKET defaults to research-files.',
      { status: 503, code: 'STORAGE_NOT_CONFIGURED' }
    );
  }
  return config;
}

function encodeObjectPath(objectPath) {
  return String(objectPath)
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function storageFetch(config, url, options, { attempts = 4, context = 'Supabase Storage request' } = {}) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          apikey: config.supabaseServiceKey,
          authorization: `Bearer ${config.supabaseServiceKey}`,
          ...(options && options.headers ? options.headers : {})
        }
      });
      if (response.ok) return response;
      const text = await response.text().catch(() => '');
      const error = new BackupError(`${context} failed with HTTP ${response.status}${text ? `: ${text.slice(0, 300)}` : ''}`, {
        status: 502,
        code: 'STORAGE_REQUEST_FAILED',
        retryable: response.status === 429 || response.status >= 500
      });
      if (!error.retryable || attempt === attempts - 1) throw error;
      lastError = error;
    } catch (err) {
      const cause = err && err.cause && err.cause.message ? err.cause.message : (err && err.message) || String(err);
      const retryable = err && (err.retryable || ['ECONNRESET', 'ETIMEDOUT', 'EAI_AGAIN', 'ENOTFOUND'].includes(err.code));
      const wrapped = err instanceof BackupError
        ? err
        : new BackupError(`${context} network error: ${cause}`, {
            status: 502,
            code: 'STORAGE_NETWORK_FAILED',
            retryable
          });
      lastError = wrapped;
      if (!retryable || attempt === attempts - 1) throw wrapped;
    }
    await sleep(Math.min(15000, 1000 * Math.pow(2, attempt)));
  }
  throw lastError;
}

async function listDirectory(config, prefix) {
  const url = `${config.supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/list/${encodeURIComponent(config.storageBucket)}`;
  const pageSize = 1000;
  const entries = [];
  for (let offset = 0; offset < 1000000; offset += pageSize) {
    const response = await storageFetch(config, url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        prefix,
        limit: pageSize,
        offset,
        sortBy: { column: 'name', order: 'asc' }
      })
    }, { context: 'Supabase Storage list' });
    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new BackupError('Supabase Storage returned an unexpected list response.', {
        status: 502,
        code: 'STORAGE_LIST_INVALID'
      });
    }
    entries.push(...data);
    if (data.length < pageSize) return entries;
  }
  throw new BackupError('Supabase Storage listing exceeded the safe page limit.', {
    code: 'STORAGE_LIST_TOO_LARGE'
  });
}

async function listObjectsRecursive(config, prefix = '', depth = 0) {
  if (depth > 24) {
    throw new BackupError('Supabase Storage folder nesting is too deep to enumerate safely.', {
      code: 'STORAGE_NESTING_TOO_DEEP'
    });
  }
  const entries = await listDirectory(config, prefix);
  const files = [];
  for (const entry of entries) {
    const name = entry && entry.name ? String(entry.name) : '';
    if (!name || name === '.emptyFolderPlaceholder') continue;
    const objectPath = prefix ? `${prefix}/${name}` : name;
    if (objectPath.includes('..') || objectPath.startsWith('/')) {
      throw new BackupError('Refusing to process an unsafe Supabase Storage object path.', {
        code: 'STORAGE_UNSAFE_PATH'
      });
    }
    const isFolder = entry.id == null || entry.metadata == null;
    if (isFolder) {
      const children = await listObjectsRecursive(config, objectPath, depth + 1);
      files.push(...children);
    } else {
      files.push({
        path: objectPath,
        size: Number(entry.metadata && entry.metadata.size ? entry.metadata.size : 0),
        updated_at: entry.updated_at || null,
        etag: entry.metadata && (entry.metadata.eTag || entry.metadata.etag) ? (entry.metadata.eTag || entry.metadata.etag) : null
      });
    }
  }
  return files;
}

async function downloadObject(config, objectPath, destination) {
  const url = `${config.supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/${encodeURIComponent(config.storageBucket)}/${encodeObjectPath(objectPath)}`;
  const response = await storageFetch(config, url, { method: 'GET' }, { context: 'Supabase Storage download' });
  await fsp.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  if (!response.body) {
    throw new BackupError('Supabase Storage returned an empty download response.', {
      status: 502,
      code: 'STORAGE_DOWNLOAD_EMPTY'
    });
  }
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(destination, { mode: 0o600 }));
  const stat = await fsp.stat(destination);
  return stat.size;
}

async function uploadObject(config, objectPath, sourcePath, mimeType = 'application/octet-stream') {
  const url = `${config.supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/${encodeURIComponent(config.storageBucket)}/${encodeObjectPath(objectPath)}`;
  const body = await fsp.readFile(sourcePath);
  const response = await storageFetch(config, url, {
    method: 'POST',
    headers: {
      'content-type': mimeType,
      'x-upsert': 'true'
    },
    body
  }, { context: 'Supabase Storage upload' });
  return response.json().catch(() => ({}));
}

function storageBaseUrl(config) {
  return `${config.supabaseUrl.replace(/\/+$/, '')}/storage/v1`;
}

function absoluteStorageUrl(config, pathOrUrl) {
  const value = String(pathOrUrl || '');
  if (/^https?:\/\//i.test(value)) return value;
  if (!value) return '';
  return `${storageBaseUrl(config)}${value.startsWith('/') ? '' : '/'}${value}`;
}

async function createSignedUploadUrl(config, objectPath) {
  const url = `${storageBaseUrl(config)}/object/upload/sign/${encodeURIComponent(config.storageBucket)}/${encodeObjectPath(objectPath)}`;
  const response = await storageFetch(config, url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-upsert': 'true'
    },
    body: JSON.stringify({})
  }, { context: 'Supabase Storage signed upload URL' });
  const data = await response.json().catch(() => ({}));
  return {
    uploadUrl: absoluteStorageUrl(config, data.url),
    token: data.token || null,
    path: objectPath
  };
}

async function createSignedDownloadUrl(config, objectPath, expiresIn = 60, downloadName = '') {
  const url = `${storageBaseUrl(config)}/object/sign/${encodeURIComponent(config.storageBucket)}/${encodeObjectPath(objectPath)}`;
  const response = await storageFetch(config, url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn })
  }, { context: 'Supabase Storage signed download URL' });
  const data = await response.json().catch(() => ({}));
  let signedUrl = absoluteStorageUrl(config, data.signedURL || data.signedUrl);
  if (signedUrl && downloadName) {
    signedUrl += `${signedUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(downloadName)}`;
  }
  return signedUrl;
}

async function deleteObject(config, objectPath) {
  const url = `${storageBaseUrl(config)}/object/${encodeURIComponent(config.storageBucket)}/${encodeObjectPath(objectPath)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: config.supabaseServiceKey,
      authorization: `Bearer ${config.supabaseServiceKey}`
    }
  });
  if (response.ok || response.status === 404) return true;
  const text = await response.text().catch(() => '');
  throw new BackupError(`Supabase Storage delete failed with HTTP ${response.status}${text ? `: ${text.slice(0, 300)}` : ''}`, {
    status: 502,
    code: 'STORAGE_DELETE_FAILED'
  });
}

async function objectExists(config, objectPath) {
  const normalized = String(objectPath || '').replace(/^\/+|\/+$/g, '');
  const slash = normalized.lastIndexOf('/');
  const prefix = slash === -1 ? '' : normalized.slice(0, slash);
  const name = slash === -1 ? normalized : normalized.slice(slash + 1);
  const entries = await listDirectory(config, prefix);
  return entries.some((entry) => entry && entry.name === name && entry.id != null && entry.metadata != null);
}

module.exports = {
  storageConfig,
  encodeObjectPath,
  storageBaseUrl,
  absoluteStorageUrl,
  listObjectsRecursive,
  downloadObject,
  uploadObject,
  createSignedUploadUrl,
  createSignedDownloadUrl,
  deleteObject,
  objectExists
};
