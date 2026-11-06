const crypto = require('crypto');
const express = require('express');
const pool = require('../db');
const store = require('../backup/store');
const { ensureBackupSchema } = require('../backup/schema');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const {
  getConfig,
  missingGoogleConfig,
  assertEncryptionConfigured,
  isGoogleConfigured,
  isEncryptionConfigured,
  isStorageConfigured
} = require('../backup/config');
const { getDriveContext, openDownloadStream, deleteBackupArtifacts } = require('../backup/drive');
const { revokeRefreshToken } = require('../backup/oauth');
const { decryptSecret } = require('../backup/crypto');
const { BackupError, safeErrorMessage, toPublicError } = require('../backup/errors');
const { triggerWorkerWebhook } = require('../backup/notifications');
const {
  validateSettingsInput,
  validateKind,
  validateRestoreConfirmation,
  validateDeleteConfirmation,
  validateArchiveConfirmation,
  validateArchiveDeleteConfirmation,
  validateArchiveRestoreConfirmation,
  intInRange,
  requireUuid,
  safeFileName,
  sanitizeErrorMessage
} = require('../backup/validation');
const { cutoffYearFor } = require('../backup/archive');
const { runJobsInline } = require('../../scripts/lib/workerRunner');
const { isPgDumpAvailable } = require('../../scripts/lib/pgTools');
const {
  dumpDatabaseToJson,
  validateDownloadablePayload,
  getInsertOrder,
  insertRows,
  resetSequences,
  encryptBuffer,
  decryptBuffer,
  tempDir,
  cleanup,
  tableIdent
} = require('../backup/dumpRestore');

const router = express.Router();

const FAILURE_WINDOW_MS = 26 * 60 * 60 * 1000;

function noStore(res) {
  res.set('Cache-Control', 'no-store, max-age=0');
}

function intLimit(value, fallback = 100, max = 200) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(1, Math.min(max, parsed));
}

function settingsView(settings) {
  if (!settings) return null;
  return {
    auto_enabled: settings.auto_enabled,
    frequency: settings.frequency,
    hour_utc: settings.hour_utc,
    weekday: settings.weekday,
    retention_count: settings.retention_count,
    retention_days: settings.retention_days,
    include_storage: settings.include_storage,
    max_attempts: settings.max_attempts,
    archive_enabled: settings.archive_enabled,
    archive_after_years: settings.archive_after_years,
    archive_month: settings.archive_month,
    archive_day: settings.archive_day,
    archive_hour_utc: settings.archive_hour_utc,
    archive_last_run_at: settings.archive_last_run_at,
    archive_next_run_at: settings.archive_next_run_at,
    last_success_at: settings.last_success_at,
    next_run_at: settings.next_run_at,
    updated_at: settings.updated_at
  };
}

function archiveView(archive) {
  if (!archive) return null;
  return {
    id: archive.id,
    year: archive.year,
    cutoff_year: archive.cutoff_year,
    status: archive.status,
    backup_id: archive.backup_id,
    research_count: archive.research_count,
    author_link_count: archive.author_link_count,
    deleted_count: archive.deleted_count,
    restored_count: archive.restored_count,
    approved_at: archive.approved_at,
    deleted_at: archive.deleted_at,
    restored_at: archive.restored_at,
    error_message: archive.error_message,
    file_name: archive.backup_file_name || null,
    encrypted_size: archive.backup_encrypted_size == null ? null : Number(archive.backup_encrypted_size),
    backup_status: archive.backup_status || null,
    backup_completed_at: archive.backup_completed_at || null,
    created_at: archive.created_at,
    updated_at: archive.updated_at
  };
}

function connectionView(connection) {
  if (!connection) {
    return {
      status: 'disconnected',
      connected: false,
      folder_name: null,
      connected_at: null,
      updated_at: null,
      last_error: null
    };
  }
  return {
    status: connection.status,
    connected: connection.status === 'connected',
    needs_reconnect: connection.status === 'needs_reconnect',
    folder_name: connection.folder_name,
    connected_at: connection.connected_at,
    updated_at: connection.updated_at,
    last_error: connection.last_error
  };
}

function validationView(validation) {
  if (!validation) return null;
  return {
    id: validation.id,
    status: validation.status,
    checks: validation.checks,
    error_message: validation.error_message,
    staging_target: validation.staging_target,
    created_at: validation.created_at,
    started_at: validation.started_at,
    finished_at: validation.finished_at
  };
}

function manifestSummary(manifest) {
  if (!manifest || typeof manifest !== 'object') return null;
  return {
    app: manifest.app || null,
    schema_version: manifest.schema_version || null,
    kind: manifest.kind || null,
    created_at: manifest.created_at || null,
    plaintext_size: manifest.plaintext_size || null,
    plaintext_sha256: manifest.plaintext_sha256 || null,
    encrypted_size: manifest.encrypted_size || null,
    encrypted_sha256: manifest.encrypted_sha256 || null,
    database: manifest.database || null,
    dump: manifest.dump ? {
      pgDumpVersion: manifest.dump.pgDumpVersion,
      host: manifest.dump.host,
      database: manifest.dump.database,
      schemas: manifest.dump.schemas,
      options: manifest.dump.options,
      snapshot_used: manifest.dump.snapshot_used,
      snapshot_fallback: manifest.dump.snapshot_fallback
    } : null,
    table_count: manifest.table_count || null,
    total_rows: manifest.total_rows || null,
    index_count: manifest.index_count || null,
    constraint_count: manifest.constraint_count || null,
    sequence_count: manifest.sequence_count || null,
    bucket: manifest.bucket || null,
    object_count: manifest.object_count || null,
    total_bytes: manifest.total_bytes || null,
    encryption: manifest.encryption || null
  };
}

function backupView(backup) {
  if (!backup) return null;
  return {
    id: backup.id,
    job_id: backup.job_id,
    set_id: backup.set_id,
    kind: backup.kind,
    trigger: backup.trigger_type,
    status: backup.status,
    file_name: backup.file_name,
    file_size: backup.file_size == null ? null : Number(backup.file_size),
    encrypted_size: backup.encrypted_size == null ? null : Number(backup.encrypted_size),
    file_sha256: backup.file_sha256,
    content_sha256: backup.content_sha256,
    encryption: backup.encryption,
    format: backup.format,
    pg_version: backup.pg_version,
    schema_version: backup.schema_version,
    manifest: manifestSummary(backup.manifest),
    created_at: backup.created_at,
    completed_at: backup.completed_at,
    deleted_at: backup.deleted_at,
    deleted_reason: backup.deleted_reason || null,
    error_message: backup.error_message,
    last_validation: validationView(backup.last_validation)
  };
}

function jobView(job) {
  if (!job) return null;
  return {
    id: job.id,
    kind: job.kind,
    trigger: job.trigger_type,
    status: job.status,
    attempt: job.attempt,
    max_attempts: job.max_attempts,
    error_message: job.error_message,
    next_attempt_at: job.next_attempt_at,
    created_at: job.created_at,
    started_at: job.started_at,
    finished_at: job.finished_at
  };
}

function auditView(entry) {
  return {
    id: entry.id,
    admin_id: entry.admin_id,
    action: entry.action,
    target_type: entry.target_type,
    target_id: entry.target_id,
    ip: entry.ip,
    user_agent: entry.user_agent,
    details: entry.details,
    created_at: entry.created_at
  };
}

function timingSafeEqualText(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function authorizeCron(req, res, next) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.authorization || '';
  if (secret && timingSafeEqualText(header, `Bearer ${secret}`)) return next();
  return authenticateToken(req, res, () => requireAdmin(req, res, next));
}

router.get('/cron', authorizeCron, async (req, res) => {
  noStore(res);
  try {
    await ensureBackupSchema();
    const stale = await store.requeueStaleJobs();
    const scheduled = await store.enqueueScheduledJobs();
    const scheduledArchives = await store.enqueueScheduledArchives();
    if (scheduled.warning) {
      await store.logAudit({
        action: 'backup.scheduled.skipped',
        targetType: 'settings',
        targetId: '1',
        req,
        details: { reason: scheduled.reason || 'warning', warning: scheduled.warning }
      });
    }
    if (scheduledArchives.warning) {
      await store.logAudit({
        action: 'archive.scheduled.skipped',
        targetType: 'settings',
        targetId: '1',
        req,
        details: { reason: scheduledArchives.reason || 'warning', warning: scheduledArchives.warning }
      });
    }
    const archiveJobs = (scheduledArchives.enqueued || []).map((entry) => entry.job);
    if ((Array.isArray(scheduled.enqueued) && scheduled.enqueued.length) || archiveJobs.length) {
      await store.logAudit({
        action: 'backup.scheduled.enqueued',
        targetType: 'job',
        targetId: [...(scheduled.enqueued || []), ...archiveJobs].map((job) => job.id).join(','),
        req,
        details: {
          count: (scheduled.enqueued || []).length + archiveJobs.length,
          kinds: [...(scheduled.enqueued || []), ...archiveJobs].map((job) => job.kind)
        }
      });
      await triggerWorkerWebhook();
    }
    res.json({
      ok: true,
      requeued_stale: stale.length,
      enqueued: [...(scheduled.enqueued || []), ...archiveJobs].map(jobView),
      enqueued_archives: archiveJobs.map(jobView),
      next_run_at: scheduled.next_run_at || null,
      next_archive_run_at: scheduledArchives.next_run_at || null,
      warning: scheduled.warning || scheduledArchives.warning || null,
      reason: scheduled.reason || scheduledArchives.reason || null
    });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.use(authenticateToken, requireAdmin);

router.get('/overview', async (req, res) => {
  noStore(res);
  try {
    await ensureBackupSchema();
    const config = getConfig();
    const [connection, settings, counts, lastSuccess, activeJobs, failures, heartbeat] = await Promise.all([
      store.getConnection(),
      store.getSettings(),
      store.getBackupCounts(),
      store.getLastSuccessfulBackup(),
      store.listActiveJobs(),
      store.listRecentFailures(5),
      store.getWorkerHeartbeat()
    ]);

    const warnings = [];
    const missingGoogle = missingGoogleConfig(config);
    if (missingGoogle.length) {
      warnings.push(`Google OAuth is not configured. Missing: ${missingGoogle.join(', ')}.`);
      if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
        warnings.push(`This is a Vercel ${process.env.VERCEL_ENV} deployment. Environment variables scoped only to Production are not available here.`);
      }
    }
    if (!isEncryptionConfigured(config)) warnings.push('BACKUP_ENCRYPTION_KEY is not set. Backups and token storage are disabled.');
    if (connection && connection.status === 'needs_reconnect') warnings.push('Google Drive authorization expired. Reconnect Google Drive.');
    if (!connection) warnings.push('Google Drive is not connected.');
    if (settings.auto_enabled && !connection) warnings.push('Automatic backups are enabled, but Google Drive is not connected.');
    if (settings.archive_enabled && !connection) warnings.push('Yearly archiving is enabled, but Google Drive is not connected.');
    if (settings.include_storage && !isStorageConfigured(config)) warnings.push('Storage backups are enabled in settings, but Supabase Storage is not configured.');
    if ((settings.auto_enabled || settings.archive_enabled) && !config.cronSecret) warnings.push('CRON_SECRET is not set. Vercel cron requests will be rejected.');
    if ((settings.auto_enabled || settings.archive_enabled || activeJobs.length > 0) && !heartbeat) warnings.push('No backup worker has checked in yet. Configure the worker or GitHub Actions workflow.');
    if (heartbeat && (settings.auto_enabled || settings.archive_enabled)) {
      const seen = new Date(heartbeat.last_seen_at).getTime();
      if (Number.isFinite(seen) && Date.now() - seen > FAILURE_WINDOW_MS) warnings.push('The backup worker has not checked in for over 26 hours.');
    }

    res.json({
      configured: {
        google: isGoogleConfigured(config),
        encryption: isEncryptionConfigured(config),
        storage: isStorageConfigured(config),
        staging: Boolean(config.stagingDatabaseUrl),
        cron: Boolean(config.cronSecret)
      },
      connection: connectionView(connection),
      settings: settingsView(settings),
      counts,
      last_success: backupView(lastSuccess),
      last_success_at: settings.last_success_at || (lastSuccess ? lastSuccess.completed_at : null),
      next_scheduled_at: settings.auto_enabled ? settings.next_run_at : null,
      next_archive_scheduled_at: settings.archive_enabled ? settings.archive_next_run_at : null,
      active_jobs: activeJobs.map(jobView),
      recent_failures: failures.map(jobView),
      worker: heartbeat ? {
        last_seen_at: heartbeat.last_seen_at,
        worker_id: heartbeat.worker_id,
        version: heartbeat.version,
        hostname: heartbeat.hostname
      } : null,
      warnings
    });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.get('/settings', async (req, res) => {
  noStore(res);
  try {
    const settings = await store.getSettings();
    res.json({ settings: settingsView(settings) });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.put('/settings', async (req, res) => {
  noStore(res);
  try {
    const current = await store.getSettings();
    const merged = validateSettingsInput(req.body, current);
    const updated = await store.updateSettings(merged, req.user.id);
    await store.logAudit({
      adminId: req.user.id,
      action: 'backup.settings.updated',
      targetType: 'settings',
      targetId: '1',
      req,
      details: { changed: Object.keys(req.body || {}) }
    });
    res.json({ settings: settingsView(updated) });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.get('/activity', async (req, res) => {
  noStore(res);
  try {
    const limit = intLimit(req.query.limit, 50, 100);
    const [audit, jobs] = await Promise.all([
      store.listAudit(limit),
      store.listJobs(limit)
    ]);
    res.json({ activity: audit.map(auditView), jobs: jobs.map(jobView) });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.get('/', async (req, res) => {
  noStore(res);
  try {
    const limit = intLimit(req.query.limit, 100, 200);
    const backups = await store.listBackups(limit);
    res.json({ backups: backups.map(backupView) });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.get('/archives', async (req, res) => {
  noStore(res);
  try {
    const limit = intLimit(req.query.limit, 100, 200);
    const settings = await store.getSettings();
    const cutoffYear = cutoffYearFor(new Date(), settings.archive_after_years);
    const [archives, eligibleYears] = await Promise.all([
      store.listResearchArchives(limit),
      store.listArchiveEligibleYears(cutoffYear)
    ]);
    res.json({
      archives: archives.map(archiveView),
      eligible_years: eligibleYears.map((row) => ({
        year: row.year,
        research_count: row.research_count,
        latest_archive_id: row.latest_archive_id,
        latest_archive_status: row.latest_archive_status
      })),
      cutoff_year: cutoffYear
    });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.post('/archives', async (req, res) => {
  noStore(res);
  try {
    validateArchiveConfirmation(req.body && req.body.confirm);
    const settings = await store.getSettings();
    const cutoffYear = cutoffYearFor(new Date(), settings.archive_after_years);
    const year = intInRange(req.body && req.body.year, 1900, cutoffYear, 'year');
    const config = getConfig();
    assertEncryptionConfigured(config);
    const connection = await store.getConnection();
    if (!connection || connection.status !== 'connected') {
      throw new BackupError('Connect Google Drive before creating a yearly archive.', {
        status: 409,
        code: 'DRIVE_NOT_CONNECTED'
      });
    }

    const queued = await store.enqueueYearArchive({
      year,
      cutoffYear,
      requestedBy: req.user.id,
      triggerType: 'manual'
    });
    await store.logAudit({
      adminId: req.user.id,
      action: 'archive.requested',
      targetType: 'research_archive',
      targetId: queued.archive.id,
      req,
      details: { year, cutoff_year: cutoffYear }
    });
    await triggerWorkerWebhook();
    res.status(202).json({
      archive: archiveView(queued.archive),
      job: jobView(queued.job),
      message: 'Yearly archive queued. The backup worker will export, encrypt, upload, and verify it.'
    });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.post('/archives/:id/approve-delete', async (req, res) => {
  noStore(res);
  try {
    const id = requireUuid(req.params.id, 'archive id');
    const archive = await store.getResearchArchive(id);
    if (!archive) {
      throw new BackupError('Year archive not found.', { status: 404, code: 'ARCHIVE_NOT_FOUND' });
    }
    validateArchiveDeleteConfirmation(req.body && req.body.confirm, archive.year);
    const queued = await store.enqueueArchiveDelete({ archiveId: id, approvedBy: req.user.id });
    await store.logAudit({
      adminId: req.user.id,
      action: 'archive.delete_approved',
      targetType: 'research_archive',
      targetId: id,
      req,
      details: { year: archive.year, research_count: archive.research_count }
    });
    await triggerWorkerWebhook();
    res.status(202).json({
      job: jobView(queued.job),
      message: 'Approved. The worker will re-verify the archive and current records before deleting archived research.'
    });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.post('/archives/:id/restore', async (req, res) => {
  noStore(res);
  try {
    const id = requireUuid(req.params.id, 'archive id');
    const archive = await store.getResearchArchive(id);
    if (!archive) {
      throw new BackupError('Year archive not found.', { status: 404, code: 'ARCHIVE_NOT_FOUND' });
    }
    validateArchiveRestoreConfirmation(req.body && req.body.confirm, archive.year);
    const queued = await store.enqueueArchiveRestore({ archiveId: id, requestedBy: req.user.id });
    await store.logAudit({
      adminId: req.user.id,
      action: 'archive.restore_requested',
      targetType: 'research_archive',
      targetId: id,
      req,
      details: { year: archive.year }
    });
    await triggerWorkerWebhook();
    res.status(202).json({
      job: jobView(queued.job),
      message: 'Restore queued. Existing research codes will be skipped.'
    });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.post('/', async (req, res) => {
  noStore(res);
  try {
    const requested = req.body && req.body.kind ? req.body.kind : 'database';
    const config = getConfig();
    assertEncryptionConfigured(config);
    const connection = await store.getConnection();
    if (!connection || connection.status !== 'connected') {
      throw new BackupError('Connect Google Drive before requesting a backup.', {
        status: 409,
        code: 'DRIVE_NOT_CONNECTED'
      });
    }
    const settings = await store.getSettings();
    let kinds;
    let warning = null;
    if (requested === 'full') {
      kinds = ['database'];
      if (isStorageConfigured(config)) kinds.push('storage');
      else warning = 'Storage backup skipped because Supabase Storage is not configured.';
    } else {
      validateKind(requested);
      if (requested === 'storage' && !isStorageConfigured(config)) {
        throw new BackupError('Supabase Storage is not configured.', {
          status: 400,
          code: 'STORAGE_NOT_CONFIGURED'
        });
      }
      kinds = [requested];
    }

    const queued = await store.enqueueManualBackups({
      kinds,
      requestedBy: req.user.id,
      maxAttempts: settings.max_attempts,
      payload: { source: 'dashboard' }
    });

    await store.logAudit({
      adminId: req.user.id,
      action: 'backup.requested',
      targetType: 'job',
      targetId: queued.jobs.map((job) => job.id).join(','),
      req,
      details: {
        kinds,
        set_id: queued.set_id,
        replaced_jobs: (queued.replaced || []).map((job) => ({ id: job.id, kind: job.kind }))
      }
    });
    if (queued.replaced && queued.replaced.length) {
      await store.logAudit({
        adminId: req.user.id,
        action: 'backup.replaced_queued',
        targetType: 'job',
        targetId: queued.replaced.map((job) => job.id).join(','),
        req,
        details: { replaced_by: queued.jobs.map((job) => job.id).join(','), kinds }
      });
    }

    if (kinds.includes('database') && !(await isPgDumpAvailable())) {
      await triggerWorkerWebhook();
      await store.logAudit({
        adminId: req.user.id,
        action: 'backup.deferred_to_worker',
        targetType: 'job',
        targetId: queued.jobs.map((job) => job.id).join(','),
        req,
        details: { kinds, reason: 'pg_dump_unavailable' }
      });
      return res.status(202).json({
        queued: queued.jobs.map(jobView),
        set_id: queued.set_id,
        replaced: queued.replaced || [],
        warning: warning || null,
        message: 'Backup queued. The backup worker will create it shortly.'
      });
    }

    const summary = await runJobsInline(queued.jobs);

    const failedJobs = summary.jobs.filter((entry) => entry.status !== 'completed');
    if (failedJobs.length) {
      const firstError = failedJobs.find((entry) => entry.error);
      throw new BackupError(firstError ? firstError.error : 'The backup failed before completing.', {
        status: 502,
        code: 'BACKUP_FAILED',
        details: { jobs: failedJobs.map(({ id, kind, status }) => ({ id, kind, status })) }
      });
    }

    const completedBackups = summary.jobs.map((entry) => entry.backup).filter(Boolean);
    const replacedPrevious = [];
    const replaceErrors = [];
    try {
      const ctx = await getDriveContext();
      for (const backup of completedBackups) {
        const superseded = await store.listSupersededBackups(backup.kind, backup.id);
        for (const old of superseded) {
          try {
            await deleteBackupArtifacts(ctx, old);
            await store.markBackupDeleted(old.id, { adminId: req.user.id, reason: 'replaced' });
            replacedPrevious.push({ id: old.id, kind: old.kind, file_name: old.file_name });
            await store.logAudit({
              adminId: req.user.id,
              action: 'backup.replaced_previous',
              targetType: 'backup',
              targetId: old.id,
              req,
              details: { kind: old.kind, replaced_by: backup.id, file_name: old.file_name }
            });
          } catch (err) {
            replaceErrors.push(safeErrorMessage(err));
            await store.logAudit({
              action: 'backup.replaced_previous.failed',
              targetType: 'backup',
              targetId: old.id,
              details: { kind: old.kind, replaced_by: backup.id, error: safeErrorMessage(err) }
            });
          }
        }
      }
    } catch (err) {
      replaceErrors.push(safeErrorMessage(err));
    }

    res.json({
      completed: completedBackups.map(backupView),
      set_id: queued.set_id,
      replaced_previous: replacedPrevious,
      warning: [warning, ...replaceErrors].filter(Boolean).join(' ') || null,
      message: replacedPrevious.length
        ? 'Backup completed. The previous backup was replaced.'
        : 'Backup completed.'
    });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.post('/drive/disconnect', async (req, res) => {
  noStore(res);
  try {
    if (!req.body || req.body.confirm !== 'DISCONNECT') {
      throw new BackupError('Type DISCONNECT to confirm disconnecting Google Drive.', {
        status: 400,
        code: 'DISCONNECT_CONFIRMATION_REQUIRED'
      });
    }
    const connection = await store.getConnection();
    if (!connection) {
      throw new BackupError('Google Drive is already disconnected.', { status: 409, code: 'DRIVE_NOT_CONNECTED' });
    }
    let revoked = false;
    try {
      const refreshToken = decryptSecret({
        ciphertext: connection.refresh_token_ciphertext,
        iv: connection.refresh_token_iv,
        tag: connection.refresh_token_tag
      });
      revoked = await revokeRefreshToken(refreshToken);
    } catch (_) {
      revoked = false;
    }
    await store.deleteConnection();
    await store.logAudit({
      adminId: req.user.id,
      action: 'drive.disconnected',
      targetType: 'google_drive',
      targetId: null,
      req,
      details: { token_revoked: revoked, backups_deleted: false }
    });
    res.json({
      disconnected: true,
      token_revoked: revoked,
      message: 'Google Drive disconnected. Existing backup files remain in Google Drive until removed there.'
    });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.get('/:id/download', async (req, res) => {
  try {
    const id = requireUuid(req.params.id, 'backup id');
    const backup = await store.getBackupById(id);
    if (!backup || backup.status !== 'completed' || !backup.drive_file_id) {
      throw new BackupError('Backup not found or not completed.', { status: 404, code: 'BACKUP_NOT_FOUND' });
    }
    const ctx = await getDriveContext();
    const { metadata, stream } = await openDownloadStream(ctx, backup.drive_file_id);
    if (backup.encrypted_size != null && metadata.size != null && Number(metadata.size) !== Number(backup.encrypted_size)) {
      stream.destroy();
      throw new BackupError('Google Drive file size does not match the recorded backup. Refusing to download a mismatched file.', {
        status: 409,
        code: 'BACKUP_SIZE_MISMATCH'
      });
    }

    await store.logAudit({
      adminId: req.user.id,
      action: 'backup.downloaded',
      targetType: 'backup',
      targetId: backup.id,
      req,
      details: { kind: backup.kind, size: backup.encrypted_size == null ? null : Number(backup.encrypted_size) }
    });

    res.set('Cache-Control', 'no-store, max-age=0');
    res.set('Content-Type', 'application/octet-stream');
    if (metadata.size != null) res.set('Content-Length', String(metadata.size));
    res.set('Content-Disposition', `attachment; filename="${safeFileName(backup.file_name)}"`);
    stream.on('error', () => {
      if (!res.headersSent) res.status(502).json({ error: 'Backup download stream failed.', code: 'DOWNLOAD_FAILED' });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (err) {
    const publicError = toPublicError(err);
    if (!res.headersSent) res.status(publicError.status).json(publicError.body);
    else res.destroy();
  }
});

router.post('/:id/validate', async (req, res) => {
  noStore(res);
  try {
    const id = requireUuid(req.params.id, 'backup id');
    validateRestoreConfirmation(req.body && req.body.confirm);
    const backup = await store.getBackupById(id);
      if (!backup || backup.status !== 'completed') {
        throw new BackupError('Only completed backups can be validated.', { status: 404, code: 'BACKUP_NOT_FOUND' });
      }
      if (backup.kind === 'year_archive') {
        throw new BackupError('Use the yearly archive restore action for archive files.', {
          status: 409,
          code: 'ARCHIVE_RESTORE_REQUIRED'
        });
      }
      const config = getConfig();
    if (backup.kind === 'database' && !config.stagingDatabaseUrl) {
      throw new BackupError(
        'RESTORE_STAGING_DATABASE_URL is not configured. A separate staging database is required to validate a database restore safely.',
        { status: 503, code: 'STAGING_NOT_CONFIGURED' }
      );
    }
    const queued = await store.enqueueRestoreValidation({
      backupId: id,
      requestedBy: req.user.id,
      confirmationNote: sanitizeErrorMessage(req.body && req.body.note ? req.body.note : 'Administrator confirmed staged restore validation', 500)
    });
    await store.logAudit({
      adminId: req.user.id,
      action: 'backup.restore.validation_requested',
      targetType: 'backup',
      targetId: id,
      req,
      details: { validation_id: queued.validation.id, kind: backup.kind }
    });
    await triggerWorkerWebhook();
    res.status(202).json({
      validation: validationView(queued.validation),
      job: jobView(queued.job),
      message: 'Staged restore validation queued. Production will not be modified.'
    });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.post('/:id/restore-request', async (req, res) => {
  noStore(res);
  try {
    const id = requireUuid(req.params.id, 'backup id');
    if (!req.body || req.body.confirm !== 'RESTORE') {
      throw new BackupError('Type RESTORE to confirm the production cutover request.', {
        status: 400,
        code: 'RESTORE_CONFIRMATION_REQUIRED'
      });
    }
    const backup = await store.getBackupById(id);
      if (!backup || backup.status !== 'completed') {
        throw new BackupError('Only completed backups can be selected for recovery.', {
          status: 404,
          code: 'BACKUP_NOT_FOUND'
        });
      }
      if (backup.kind === 'year_archive') {
        throw new BackupError('Use the yearly archive restore action for archive files.', {
          status: 409,
          code: 'ARCHIVE_RESTORE_REQUIRED'
        });
      }
      const validation = await store.getLatestValidationForBackup(id);
    const readyForCutover = Boolean(validation && validation.status === 'completed' && validation.checks && validation.checks.ok);

    await store.logAudit({
      adminId: req.user.id,
      action: 'backup.restore.requested',
      targetType: 'backup',
      targetId: id,
      req,
      details: {
        kind: backup.kind,
        validation_id: validation ? validation.id : null,
        ready_for_cutover: readyForCutover,
        note: sanitizeErrorMessage(req.body.note || '', 500)
      }
    });

    const instructions = backup.kind === 'database'
      ? [
          'This endpoint never modifies production. Complete these steps during a maintenance window.',
          '1. Confirm the latest staged restore validation succeeded and review its checks.',
          '2. Put the application in maintenance/read-only mode and stop writes.',
          '3. Create a fresh pre-restore backup and verify it completed.',
          '4. Download and decrypt this backup with the worker CLI: npm run backup:download -- <backup-id> ./restore.dump',
          '5. Restore into a controlled target database with pg_restore (direct connection, no --clean against an unverified target).',
          '6. Run smoke tests: login, research list, author list, stats, and row counts.',
          '7. Cut over DATABASE_URL only after verification, then restart/redeploy the application.',
          '8. Keep the previous database and pre-restore backup available for rollback.',
          'Never run pg_restore --clean directly against production without explicit change approval.'
        ]
      : [
          'This endpoint never modifies production Supabase Storage. Complete these steps during a maintenance window.',
          '1. Confirm the latest staged archive validation succeeded and review its checks.',
          '2. Download and decrypt the archive with the worker CLI: npm run backup:download -- <backup-id> ./storage.tar.gz',
          '3. Inspect backup-manifest.json and verify each object checksum before uploading.',
          '4. Restore objects to a separate Supabase Storage bucket first and validate.',
          '5. Cut over application configuration only after validation, and keep the previous bucket for rollback.'
        ];

    res.json({
      backup: backupView(backup),
      validation: validationView(validation),
      ready_for_cutover: readyForCutover,
      production_modified: false,
      instructions
    });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.delete('/:id', async (req, res) => {
  noStore(res);
  try {
    const id = requireUuid(req.params.id, 'backup id');
    validateDeleteConfirmation(req.body && req.body.confirm);
    const backup = await store.getBackupById(id);
    if (!backup || backup.status === 'deleted') {
      throw new BackupError('Backup not found.', { status: 404, code: 'BACKUP_NOT_FOUND' });
    }
      if (['uploading', 'verifying'].includes(backup.status)) {
        throw new BackupError('An in-progress backup cannot be deleted.', { status: 409, code: 'BACKUP_IN_PROGRESS' });
      }
      if (backup.kind === 'year_archive') {
        throw new BackupError('Yearly archive files are retained and cannot be deleted from backup history.', {
          status: 409,
          code: 'ARCHIVE_BACKUP_PROTECTED'
        });
      }

      if (backup.drive_file_id || backup.manifest_drive_file_id) {
      const ctx = await getDriveContext();
      await deleteBackupArtifacts(ctx, backup);
    }

    const deleted = await store.markBackupDeleted(id, {
      adminId: req.user.id,
      reason: 'manual'
    });
    await store.logAudit({
      adminId: req.user.id,
      action: 'backup.deleted',
      targetType: 'backup',
      targetId: id,
      req,
      details: { kind: backup.kind, file_name: backup.file_name }
    });
    res.json({ deleted: true, backup: backupView(deleted) });
  } catch (err) {
    const publicError = toPublicError(err);
    res.status(publicError.status).json(publicError.body);
  }
});

router.post('/downloadable', async (req, res) => {
  let client = null;
  let temp = null;
  try {
    const config = getConfig();
    if (!config.backupDatabaseUrl && !config.productionDatabaseUrl) {
      throw new BackupError('Database URL is not configured.', {
        status: 503,
        code: 'DATABASE_URL_MISSING'
      });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const payload = await dumpDatabaseToJson(client);
    await client.query('COMMIT');
    await client.release();
    client = null;

    const rowCount = payload.tables.reduce((sum, table) => sum + table.rows.length, 0);
    const json = Buffer.from(JSON.stringify(payload), 'utf8');

    temp = await tempDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `researchhub-backup-${timestamp}`;
    const { buffer, fileName: outName, encrypted } = await encryptBuffer(json, temp, fileName);

    await store.logAudit({
      adminId: req.user.id,
      action: 'backup.downloadable.created',
      targetType: 'backup',
      targetId: null,
      req,
      details: {
        tables: payload.tables.length,
        rows: rowCount,
        encrypted,
        file_name: outName
      }
    });

    res.set('Cache-Control', 'no-store, max-age=0');
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${safeFileName(outName)}"`);
    res.set('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    const publicError = toPublicError(err);
    if (!res.headersSent) res.status(publicError.status).json(publicError.body);
    else res.destroy();
  } finally {
    if (client) client.release();
    if (temp) await cleanup(temp);
  }
});

router.post('/restore-upload', async (req, res) => {
  let client = null;
  let temp = null;
  try {
    if (!req.body || req.body.confirm !== 'RESTORE') {
      throw new BackupError('Type RESTORE to confirm replacing the database with this backup.', {
        status: 400,
        code: 'RESTORE_CONFIRMATION_REQUIRED'
      });
    }

    const raw = req.body.backup || req.body.file || req.body.data;
    if (typeof raw !== 'string' || !raw.length) {
      throw new BackupError('No backup file was provided.', { status: 400, code: 'NO_BACKUP_FILE' });
    }

    const base64 = String(raw).replace(/^data:.*;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');

    temp = await tempDir();
    const plaintext = await decryptBuffer(buffer, temp, 'restore-upload');
    const payload = validateDownloadablePayload(JSON.parse(plaintext.toString('utf8')));

    client = await pool.connect();
    await client.query('BEGIN');

    const tableNames = payload.tables.map((table) => table.name);
    if (tableNames.length) {
      await client.query(
        `TRUNCATE ${tableNames.map((name) => tableIdent('public', name)).join(', ')} RESTART IDENTITY CASCADE`
      );
    }

    const order = await getInsertOrder(client, tableNames);
    const byName = new Map(payload.tables.map((table) => [table.name, table]));
    for (const name of order) {
      const table = byName.get(name);
      if (!table) continue;
      await insertRows(client, name, table.columns, table.rows);
    }

    await resetSequences(client, tableNames);
    await client.query('COMMIT');
    await client.release();
    client = null;

    await store.logAudit({
      adminId: req.user.id,
      action: 'backup.downloadable.restored',
      targetType: 'backup',
      targetId: null,
      req,
      details: { tables: payload.tables.length }
    });

    res.json({
      ok: true,
      restored_tables: tableNames.length,
      message: 'Database restored from the uploaded backup.'
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    const publicError = toPublicError(err);
    if (!res.headersSent) res.status(publicError.status).json(publicError.body);
    else res.destroy();
  } finally {
    if (client) client.release();
    if (temp) await cleanup(temp);
  }
});

module.exports = router;
