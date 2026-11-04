import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API } from '../context/AuthContext';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../components/ui/select';
import {
  AlertTriangle, CalendarClock, CheckCircle2, Cloud, Database, Download, FolderOpen,
  HardDrive, History, Link2, Loader2, Play, RefreshCw, ShieldCheck, Trash2, Unlink, XCircle
} from 'lucide-react';

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
  });
}

function statusVariant(status) {
  if (['completed', 'connected', 'ready', 'restored'].includes(status)) return 'success';
  if (['failed', 'needs_reconnect', 'error'].includes(status)) return 'rejected';
  if (['deleted', 'disconnected', 'canceled'].includes(status)) return 'secondary';
  return 'pending';
}

function kindLabel(kind) {
  if (kind === 'database') return 'PostgreSQL';
  if (kind === 'storage') return 'Storage';
  if (kind === 'year_archive') return 'Yearly archive';
  return kind;
}

function validationReady(backup) {
  return Boolean(backup?.last_validation?.status === 'completed' && backup?.last_validation?.checks?.ok);
}

export default function AdminBackups() {
  const [overview, setOverview] = useState(null);
  const [backups, setBackups] = useState([]);
  const [activity, setActivity] = useState([]);
  const [settingsForm, setSettingsForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [disconnectConfirm, setDisconnectConfirm] = useState('');
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreConfirm, setRestoreConfirm] = useState('');
  const [restoreInstructions, setRestoreInstructions] = useState(null);
  const [restoreReady, setRestoreReady] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [validationTarget, setValidationTarget] = useState(null);
  const [archives, setArchives] = useState([]);
  const [archiveYears, setArchiveYears] = useState([]);
  const [archiveCutoff, setArchiveCutoff] = useState(null);
  const [archiveDeleteTarget, setArchiveDeleteTarget] = useState(null);
  const [archiveDeleteConfirm, setArchiveDeleteConfirm] = useState('');
  const [archiveRestoreTarget, setArchiveRestoreTarget] = useState(null);
  const [archiveRestoreConfirm, setArchiveRestoreConfirm] = useState('');
  const settingsDirtyRef = useRef(false);

  const applyOverview = (data) => {
    setOverview(data);
    if (data?.settings && !settingsDirtyRef.current) setSettingsForm(data.settings);
  };

  const load = async () => {
    try {
      const [overviewResponse, backupsResponse, activityResponse, archivesResponse] = await Promise.all([
        axios.get(`${API}/backups/overview`),
        axios.get(`${API}/backups/?limit=100`),
        axios.get(`${API}/backups/activity?limit=30`),
        axios.get(`${API}/backups/archives?limit=100`)
      ]);
      applyOverview(overviewResponse.data);
      const nextBackups = Array.isArray(backupsResponse.data?.backups) ? backupsResponse.data.backups : [];
      setBackups(nextBackups);
      setRestoreTarget((current) => current ? (nextBackups.find((backup) => backup.id === current.id) || current) : current);
      setActivity(Array.isArray(activityResponse.data?.activity) ? activityResponse.data.activity : []);
      const nextArchives = Array.isArray(archivesResponse.data?.archives) ? archivesResponse.data.archives : [];
      setArchives(nextArchives);
      setArchiveYears(Array.isArray(archivesResponse.data?.eligible_years) ? archivesResponse.data.eligible_years : []);
      setArchiveCutoff(archivesResponse.data?.cutoff_year || null);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load backup status.');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setBusy('refresh');
    setError('');
    await load();
    setBusy('');
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 25000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const google = params.get('google');
    if (!google) return;
    if (google === 'error') {
      setError(params.get('message') || 'Google Drive connection failed.');
    } else if (google === 'warning') {
      setNotice(params.get('message') || 'Google Drive connected with a warning.');
    } else {
      setNotice('Google Drive connected successfully.');
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const updateSettings = (patch) => {
    settingsDirtyRef.current = true;
    setSettingsForm((current) => ({ ...current, ...patch }));
  };

  const connectDrive = async () => {
    setBusy('connect');
    setError('');
    setNotice('');
    try {
      const response = await axios.get(`${API}/auth/google/start`);
      window.location.href = response.data.authUrl;
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to start Google Drive connection.');
      setBusy('');
    }
  };

  const disconnectDrive = async () => {
    if (disconnectConfirm !== 'DISCONNECT') {
      setError('Type DISCONNECT to confirm.');
      return;
    }
    setBusy('disconnect');
    setError('');
    try {
      const response = await axios.post(`${API}/backups/drive/disconnect`, { confirm: 'DISCONNECT' });
      setNotice(response.data.message || 'Google Drive disconnected.');
      setDisconnectOpen(false);
      setDisconnectConfirm('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to disconnect Google Drive.');
    } finally {
      setBusy('');
    }
  };

  const backupNow = async () => {
    setBusy('backup');
    setError('');
    setNotice('');
    try {
      const response = await axios.post(`${API}/backups`, { kind: 'full' });
      setNotice(response.data.warning
        ? `${response.data.message} ${response.data.warning}`
        : response.data.message || 'Backup completed.');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to complete the backup.');
    } finally {
      setBusy('');
    }
  };

  const createYearArchive = async (year) => {
    setBusy(`archive-${year}`);
    setError('');
    setNotice('');
    try {
      const response = await axios.post(`${API}/backups/archives`, { year, confirm: 'ARCHIVE' });
      setNotice(response.data.message || `${year} archive queued.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to queue this yearly archive.');
    } finally {
      setBusy('');
    }
  };

  const approveArchiveDelete = async () => {
    if (!archiveDeleteTarget) return;
    const expected = `DELETE-YEAR ${archiveDeleteTarget.year}`;
    if (archiveDeleteConfirm !== expected) {
      setError(`Type ${expected} to confirm.`);
      return;
    }
    setBusy('archive-delete');
    setError('');
    try {
      const response = await axios.post(`${API}/backups/archives/${archiveDeleteTarget.id}/approve-delete`, {
        confirm: expected
      });
      setNotice(response.data.message || 'Archive deletion approved.');
      setArchiveDeleteTarget(null);
      setArchiveDeleteConfirm('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to approve archive deletion.');
    } finally {
      setBusy('');
    }
  };

  const restoreYearArchive = async () => {
    if (!archiveRestoreTarget) return;
    const expected = `RESTORE-YEAR ${archiveRestoreTarget.year}`;
    if (archiveRestoreConfirm !== expected) {
      setError(`Type ${expected} to confirm.`);
      return;
    }
    setBusy('archive-restore');
    setError('');
    try {
      const response = await axios.post(`${API}/backups/archives/${archiveRestoreTarget.id}/restore`, {
        confirm: expected
      });
      setNotice(response.data.message || 'Archive restore queued.');
      setArchiveRestoreTarget(null);
      setArchiveRestoreConfirm('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to queue archive restore.');
    } finally {
      setBusy('');
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    if (!settingsForm) return;
    setBusy('settings');
    setError('');
    try {
      const payload = {
        archive_enabled: Boolean(settingsForm.archive_enabled),
        archive_after_years: Number(settingsForm.archive_after_years),
        archive_month: Number(settingsForm.archive_month),
        archive_day: Number(settingsForm.archive_day),
        archive_hour_utc: Number(settingsForm.archive_hour_utc)
      };
      const response = await axios.put(`${API}/backups/settings`, payload);
      setSettingsForm(response.data.settings);
      settingsDirtyRef.current = false;
      setNotice('Backup settings saved.');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to save backup settings.');
    } finally {
      setBusy('');
    }
  };

  const downloadBackup = async (backup) => {
    setBusy(`download-${backup.id}`);
    setError('');
    try {
      const response = await axios.get(`${API}/backups/${backup.id}/download`, {
        responseType: 'blob',
        timeout: 120000
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.file_name || 'researchhub-backup.enc';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setNotice('Backup download started. Keep the encryption key safe.');
    } catch (err) {
      let message = err.response?.data?.error;
      if (!message && err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          message = JSON.parse(text).error;
        } catch (_) {
          message = null;
        }
      }
      setError(message || 'Unable to download this backup. Large backups may need the worker CLI.');
    } finally {
      setBusy('');
    }
  };

  const queueValidation = async () => {
    if (!restoreTarget || restoreConfirm !== 'RESTORE') {
      setError('Type RESTORE to confirm staged validation.');
      return;
    }
    setBusy('validate');
    setError('');
    try {
      const response = await axios.post(`${API}/backups/${restoreTarget.id}/validate`, {
        confirm: 'RESTORE',
        note: 'Administrator confirmed staged restore validation'
      });
      setNotice(response.data.message || 'Staged restore validation queued.');
      setRestoreConfirm('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to queue restore validation.');
    } finally {
      setBusy('');
    }
  };

  const requestCutover = async () => {
    if (!restoreTarget) return;
    setBusy('cutover');
    setError('');
    try {
      const response = await axios.post(`${API}/backups/${restoreTarget.id}/restore-request`, {
        confirm: 'RESTORE',
        note: 'Administrator requested production cutover instructions'
      });
      setRestoreInstructions(response.data.instructions || []);
      setRestoreReady(Boolean(response.data.ready_for_cutover));
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to prepare cutover instructions.');
    } finally {
      setBusy('');
    }
  };

  const deleteBackup = async () => {
    if (!deleteTarget || deleteConfirm !== 'DELETE') {
      setError('Type DELETE to confirm.');
      return;
    }
    setBusy('delete');
    setError('');
    try {
      await axios.delete(`${API}/backups/${deleteTarget.id}`, { data: { confirm: 'DELETE' } });
      setNotice('Backup deleted from Google Drive and marked deleted.');
      setDeleteTarget(null);
      setDeleteConfirm('');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete this backup.');
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-muted-green">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading backup status...
        </div>
      </div>
    );
  }

  const connection = overview?.connection;
  const settings = overview?.settings;
  const counts = overview?.counts || {};
  const configured = overview?.configured || {};
  const warnings = Array.isArray(overview?.warnings) ? overview.warnings : [];
  const activeJobs = Array.isArray(overview?.active_jobs) ? overview.active_jobs : [];

  return (
    <div className="admin-page space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="admin-eyebrow">
            <ShieldCheck className="h-3 w-3" />
            Data Protection
          </span>
          <h1 className="admin-title mt-3">Backup &amp; <em>Recovery</em></h1>
          <p className="admin-subtitle">Encrypted PostgreSQL and storage backups stored in Google Drive</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full border-[#DCEBE5] bg-white text-[13px] font-semibold text-muted-green hover:bg-soft-green hover:text-forest" onClick={refresh} disabled={Boolean(busy)}>
            <RefreshCw className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button
            className="gradient-btn rounded-full"
            onClick={backupNow}
            disabled={busy === 'backup' || !configured.encryption || connection?.status !== 'connected'}
          >
            {busy === 'backup' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Backup Now
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">{error}</div>
          <button className="text-red-500 hover:text-red-700" onClick={() => setError('')} aria-label="Dismiss error"><XCircle className="h-4 w-4" /></button>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-3 rounded-2xl border border-[#CFE8DE] bg-soft-green px-4 py-3 text-[13.5px] text-[#0C765E]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1">{notice}</div>
          <button className="text-[#0C765E] hover:text-forest" onClick={() => setNotice('')} aria-label="Dismiss notice"><XCircle className="h-4 w-4" /></button>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-amber-800">
            <AlertTriangle className="h-4 w-4" /> Attention required
          </div>
          <ul className="mt-2 space-y-1.5 text-[13.5px] text-amber-900">
            {warnings.map((warning) => <li key={warning}>• {warning}</li>)}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="admin-panel lg:col-span-2">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title"><Cloud className="h-4 w-4 text-emerald-brand" /> Google Drive connection</h2>
            <Badge variant={statusVariant(connection?.status)} className="capitalize">
              {connection?.needs_reconnect ? 'Reconnect required' : (connection?.status || 'disconnected')}
            </Badge>
          </div>
          <div className="admin-panel-body space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#E6EDE9] bg-ivory px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8AA79E]">Backup folder</p>
                <p className="mt-1 flex items-center gap-2 text-[14px] font-semibold text-forest">
                  <FolderOpen className="h-4 w-4 text-[#0C765E]" /> {connection?.folder_name || 'Not created yet'}
                </p>
              </div>
              <div className="rounded-xl border border-[#E6EDE9] bg-ivory px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8AA79E]">Connected</p>
                <p className="mt-1 text-[14px] font-semibold text-forest">{formatDateTime(connection?.connected_at)}</p>
              </div>
            </div>
            {connection?.last_error && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">{connection.last_error}</p>
            )}
            {!configured.google && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                Server Google OAuth variables are missing. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in Vercel.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {!connection?.connected && (
                <Button className="gradient-btn rounded-full" onClick={() => connectDrive()} disabled={busy === 'connect' || !configured.google || !configured.encryption}>
                  {busy === 'connect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Connect Google Drive
                </Button>
              )}
              {connection?.connected && (
                <>
                  <Button variant="outline" className="rounded-full border-[#DCEBE5] bg-white text-[13px] font-semibold text-muted-green hover:bg-soft-green hover:text-forest" onClick={() => connectDrive()} disabled={busy === 'connect'}>
                    <Link2 className="h-4 w-4" /> Reconnect
                  </Button>
                  <Button variant="outline" className="rounded-full border-red-200 bg-white text-[13px] font-semibold text-red-600 hover:bg-red-50" onClick={() => setDisconnectOpen(true)} disabled={busy === 'disconnect'}>
                    <Unlink className="h-4 w-4" /> Disconnect
                  </Button>
                </>
              )}
            </div>
            {activeJobs.length > 0 && (
              <div className="rounded-xl border border-[#DCEBE5] bg-white px-4 py-3 text-[13px] text-muted-green">
                <span className="font-semibold text-forest">{activeJobs.length} job(s) active:</span>{' '}
                {activeJobs.map((job) => `${kindLabel(job.kind)} (${job.status})`).join(', ')}
              </div>
            )}
          </div>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2 className="admin-panel-title"><CalendarClock className="h-4 w-4 text-emerald-brand" /> Schedule</h2>
          </div>
          <div className="admin-panel-body space-y-3 text-[13.5px]">
            <div className="flex items-center justify-between gap-3"><span className="text-muted-green">Last success</span><span className="text-right font-semibold text-forest">{formatDateTime(overview?.last_success_at)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-green">Next scheduled</span><span className="text-right font-semibold text-forest">{settings?.auto_enabled ? formatDateTime(overview?.next_scheduled_at) : 'Disabled'}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-green">Worker heartbeat</span><span className="text-right font-semibold text-forest">{formatDateTime(overview?.worker?.last_seen_at)}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-green">Completed backups</span><span className="font-semibold text-forest">{counts.completed || 0}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-green">Failed jobs</span><span className="font-semibold text-forest">{counts.failed || 0}</span></div>
            <div className="flex items-center justify-between gap-3"><span className="text-muted-green">Stored (encrypted)</span><span className="font-semibold text-forest">{formatBytes(counts.total_encrypted_bytes)}</span></div>
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title"><CalendarClock className="h-4 w-4 text-emerald-brand" /> Yearly archive schedule</h2>
          {settingsForm && <Badge variant={settingsForm.archive_enabled ? 'success' : 'secondary'}>{settingsForm.archive_enabled ? 'Enabled' : 'Disabled'}</Badge>}
        </div>
        <form onSubmit={saveSettings} className="admin-panel-body space-y-5">
          {!settingsForm ? (
            <p className="text-[13.5px] text-muted-green">Loading settings...</p>
          ) : (
            <>
              <div className="space-y-4 rounded-2xl border border-[#E6EDE9] bg-ivory p-4">
                <p className="text-[12px] text-[#8AA79E]">Keep the current year plus previous years, then archive older approved and rejected research.</p>
                <label className="flex items-center gap-3 text-[13.5px] font-semibold text-forest">
                  <Checkbox checked={Boolean(settingsForm.archive_enabled)} onChange={(event) => updateSettings({ archive_enabled: event.target.checked })} />
                  Enable yearly archives
                </label>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Keep previous years</Label>
                    <Input type="number" min="1" max="50" value={settingsForm.archive_after_years} onChange={(event) => updateSettings({ archive_after_years: Number(event.target.value) })} className="rounded-xl border-[#DCEBE5] bg-white" />
                    <p className="text-[11.5px] text-[#8AA79E]">With 5, 2026 archives 2020 and older.</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Month</Label>
                    <Select value={String(settingsForm.archive_month)} onValueChange={(value) => updateSettings({ archive_month: Number(value) })}>
                      <SelectTrigger className="rounded-xl border-[#DCEBE5] bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }).map((_, index) => (
                          <SelectItem key={index + 1} value={String(index + 1)}>
                            {new Date(Date.UTC(2026, index, 1)).toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Day</Label>
                    <Input type="number" min="1" max="28" value={settingsForm.archive_day} onChange={(event) => updateSettings({ archive_day: Number(event.target.value) })} className="rounded-xl border-[#DCEBE5] bg-white" />
                  </div>
                  <div className="space-y-2">
                    <Label>Hour (UTC)</Label>
                    <Select value={String(settingsForm.archive_hour_utc)} onValueChange={(value) => updateSettings({ archive_hour_utc: Number(value) })}>
                      <SelectTrigger className="rounded-xl border-[#DCEBE5] bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }).map((_, hour) => (
                          <SelectItem key={hour} value={String(hour)}>{String(hour).padStart(2, '0')}:00 UTC</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[12px] text-[#8AA79E]">
                    {settingsForm.archive_next_run_at ? `Next archive run: ${formatDateTime(settingsForm.archive_next_run_at)}` : 'Archive scheduling is disabled.'}
                  </p>
                  <Button type="submit" className="gradient-btn rounded-full" disabled={busy === 'settings'}>
                    {busy === 'settings' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Save archive settings
                  </Button>
                </div>
              </div>

              <p className="text-[12px] text-[#8AA79E]">
                The scheduler only queues work. A dedicated worker exports, encrypts, uploads, and verifies archives in Google Drive.
              </p>
            </>
          )}
        </form>
      </div>

      <div className="admin-panel overflow-hidden">
        <div className="admin-panel-head">
          <div>
            <h2 className="admin-panel-title"><HardDrive className="h-4 w-4 text-emerald-brand" /> Yearly research archives</h2>
            <p className="mt-1 text-[12.5px] text-muted-green">
              {archiveCutoff ? `Eligibility cutoff: ${archiveCutoff} and older.` : 'Archive cutoff is loading.'} Deletion always requires manual approval after verification.
            </p>
          </div>
          <span className="text-[13px] font-semibold text-muted-green">{archives.length} archive(s)</span>
        </div>
        <div className="admin-panel-body space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8AA79E]">Eligible research years</p>
            {archiveYears.length === 0 ? (
              <p className="mt-2 text-[13px] text-muted-green">No approved or rejected research is old enough to archive.</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {archiveYears.map((entry) => {
                  const activeStatus = entry.latest_archive_status;
                  const canArchive = !['queued', 'archiving', 'verifying', 'delete_queued', 'deleting', 'restore_queued', 'restoring'].includes(activeStatus);
                  return (
                    <div key={entry.year} className="flex items-center gap-2 rounded-full border border-[#DCEBE5] bg-ivory px-3 py-1.5 text-[12.5px]">
                      <span className="font-semibold text-forest">{entry.year}</span>
                      <span className="text-[#8AA79E]">{entry.research_count} record(s)</span>
                      {activeStatus && <Badge variant={statusVariant(activeStatus)} className="capitalize">{activeStatus}</Badge>}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 rounded-full border-[#DCEBE5] bg-white px-2.5 text-[11.5px] font-semibold text-muted-green hover:bg-soft-green hover:text-forest"
                        onClick={() => createYearArchive(entry.year)}
                        disabled={!canArchive || busy === `archive-${entry.year}` || connection?.status !== 'connected'}
                      >
                        {busy === `archive-${entry.year}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />} Archive
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="admin-table w-full min-w-[860px]">
              <thead>
                <tr>
                  <th className="text-left">Year</th>
                  <th className="text-left">Records</th>
                  <th className="text-left">Archive file</th>
                  <th className="text-left">Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((archive) => (
                  <tr key={archive.id}>
                    <td className="font-semibold text-forest">{archive.year}</td>
                    <td className="text-[12.5px] text-muted-green">
                      {archive.research_count} research · {archive.author_link_count} author links
                      {archive.deleted_count > 0 ? ` · ${archive.deleted_count} deleted` : ''}
                      {archive.restored_count > 0 ? ` · ${archive.restored_count} restored` : ''}
                    </td>
                    <td>
                      <p className="font-mono text-[11.5px] text-forest">{archive.file_name || 'Pending upload'}</p>
                      <p className="text-[11px] text-[#8AA79E]">{formatDateTime(archive.created_at)} · {formatBytes(archive.encrypted_size)}</p>
                    </td>
                    <td>
                      <Badge variant={statusVariant(archive.status)} className="capitalize">{archive.status}</Badge>
                      {archive.error_message && <p className="mt-1 max-w-[240px] text-[11.5px] text-red-600">{archive.error_message}</p>}
                    </td>
                    <td>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-[#DCEBE5] text-[12px] font-semibold text-muted-green hover:bg-soft-green hover:text-forest"
                          onClick={() => downloadBackup({ id: archive.backup_id, file_name: archive.file_name })}
                          disabled={!archive.backup_id || archive.backup_status !== 'completed' || busy === `download-${archive.backup_id}`}
                        >
                          {busy === `download-${archive.backup_id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-red-200 text-[12px] font-semibold text-red-600 hover:bg-red-50"
                          onClick={() => { setArchiveDeleteTarget(archive); setArchiveDeleteConfirm(''); }}
                          disabled={archive.status !== 'ready'}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Approve delete
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full border-[#DCEBE5] text-[12px] font-semibold text-muted-green hover:bg-soft-green hover:text-forest"
                          onClick={() => { setArchiveRestoreTarget(archive); setArchiveRestoreConfirm(''); }}
                          disabled={archive.status !== 'completed'}
                        >
                          <Database className="h-3.5 w-3.5" /> Restore
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {archives.length === 0 && (
                  <tr className="border-0"><td colSpan={5} className="py-10 text-center text-[13.5px] text-muted-green">No yearly archives yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="admin-panel overflow-hidden">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title"><History className="h-4 w-4 text-emerald-brand" /> Backup history</h2>
          <span className="text-[13px] font-semibold text-muted-green">{backups.length} record(s)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table w-full min-w-[980px]">
            <thead>
              <tr>
                <th className="text-left">Created</th>
                <th className="text-left">Type</th>
                <th className="text-left">Trigger</th>
                <th className="text-left">Size</th>
                <th className="text-left">Status</th>
                <th className="text-left">Validation</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map((backup) => (
                <tr key={backup.id}>
                  <td>
                    <p className="font-semibold text-forest">{formatDateTime(backup.completed_at || backup.created_at)}</p>
                    <p className="font-mono text-[11px] text-[#8AA79E]">{backup.file_name}</p>
                  </td>
                  <td className="font-semibold text-forest">{kindLabel(backup.kind)}</td>
                  <td className="capitalize text-muted-green">{backup.trigger}</td>
                  <td className="font-mono text-[12.5px] text-muted-green">{formatBytes(backup.encrypted_size ?? backup.file_size)}</td>
                  <td>
                    <Badge variant={statusVariant(backup.status)} className="capitalize">{backup.status}</Badge>
                    {backup.error_message && <p className="mt-1 max-w-[220px] text-[11.5px] text-red-600">{backup.error_message}</p>}
                  </td>
                  <td>
                    {backup.last_validation ? (
                      <button className="text-left" onClick={() => setValidationTarget(backup)}>
                        <Badge variant={statusVariant(backup.last_validation.status)} className="capitalize">{backup.last_validation.status}</Badge>
                        <p className="mt-1 text-[11px] text-[#0C765E] underline">View checks</p>
                      </button>
                    ) : (
                      <span className="text-[12px] text-[#8AA79E]">Not validated</span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button variant="outline" size="sm" className="rounded-full border-[#DCEBE5] text-[12px] font-semibold text-muted-green hover:bg-soft-green hover:text-forest" onClick={() => downloadBackup(backup)} disabled={backup.status !== 'completed' || busy === `download-${backup.id}`}>
                        {busy === `download-${backup.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full border-[#DCEBE5] text-[12px] font-semibold text-muted-green hover:bg-soft-green hover:text-forest" onClick={() => { setRestoreTarget(backup); setRestoreConfirm(''); setRestoreInstructions(null); setRestoreReady(false); }} disabled={backup.kind === 'year_archive' || backup.status !== 'completed'}>
                        <Database className="h-3.5 w-3.5" /> Restore
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${backup.file_name}`} className="h-8 w-8 rounded-full p-0 text-red-500 hover:bg-red-50 hover:text-red-700" onClick={() => { setDeleteTarget(backup); setDeleteConfirm(''); }} disabled={backup.kind === 'year_archive' || ['deleted', 'uploading', 'verifying'].includes(backup.status)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr className="border-0"><td colSpan={7} className="py-14 text-center text-[13.5px] text-muted-green">No backups yet. Connect Google Drive and press Backup Now.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-head">
          <h2 className="admin-panel-title"><History className="h-4 w-4 text-emerald-brand" /> Activity log</h2>
          <span className="text-[13px] font-semibold text-muted-green">Last {activity.length} event(s)</span>
        </div>
        <div className="admin-panel-body">
          {activity.length === 0 ? (
            <p className="text-[13.5px] text-muted-green">No activity yet.</p>
          ) : (
            <div className="space-y-1">
              {activity.map((entry) => (
                <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 transition hover:bg-pale-green">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-forest">{entry.action.replaceAll('.', ' · ')}</p>
                    <p className="truncate text-[11.5px] text-[#8AA79E]">{entry.target_type || 'system'}{entry.target_id ? ` · ${entry.target_id}` : ''}{entry.details?.error ? ` · ${entry.details.error}` : ''}</p>
                  </div>
                  <span className="font-mono text-[11.5px] text-muted-green">{formatDateTime(entry.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent className="border-[#E6EDE9] bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-forest">Disconnect Google Drive?</DialogTitle>
            <DialogDescription>
              This revokes ResearchHub's Google token. Existing backup files stay in Google Drive, but the app can no longer upload or download them.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="disconnect-confirm">Type DISCONNECT to confirm</Label>
            <Input id="disconnect-confirm" value={disconnectConfirm} onChange={(event) => setDisconnectConfirm(event.target.value)} className="rounded-xl border-[#DCEBE5] bg-ivory" />
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green" onClick={() => setDisconnectOpen(false)}>Cancel</Button>
            <Button className="rounded-full bg-red-600 text-white hover:bg-red-700" onClick={disconnectDrive} disabled={busy === 'disconnect' || disconnectConfirm !== 'DISCONNECT'}>
              {busy === 'disconnect' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />} Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(restoreTarget)} onOpenChange={(open) => { if (!open) { setRestoreTarget(null); setRestoreInstructions(null); setRestoreReady(false); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#E6EDE9] bg-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-forest">Restore validation</DialogTitle>
            <DialogDescription>
              {restoreTarget ? `${kindLabel(restoreTarget.kind)} backup from ${formatDateTime(restoreTarget.completed_at || restoreTarget.created_at)}` : ''}
            </DialogDescription>
          </DialogHeader>

          {restoreInstructions ? (
            <div className="space-y-3">
              <div className={`rounded-xl border px-4 py-3 text-[13px] ${restoreReady ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-red-200 bg-red-50 text-red-800'}`}>
                <p className="font-bold uppercase tracking-[0.12em]">Manual production cutover</p>
                <p className="mt-1">
                  {restoreReady
                    ? 'Production was not modified. Follow these steps during an approved maintenance window.'
                    : 'No successful staged validation is recorded for this backup. Do not cut over until validation succeeds.'}
                </p>
              </div>
              <ol className="space-y-2 text-[13.5px] text-forest">
                {restoreInstructions.map((step, index) => <li key={`${index}-${step}`} className="rounded-lg bg-ivory px-3 py-2">{step}</li>)}
              </ol>
              <DialogFooter>
                <Button className="gradient-btn rounded-full" onClick={() => setRestoreInstructions(null)}>Back</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Production is never overwritten automatically</p>
                <p className="mt-1">Validation restores the backup into RESTORE_STAGING_DATABASE_URL only. Production cutover is manual and requires explicit approval.</p>
              </div>
              {!configured.staging && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
                  <p className="font-bold">Staging database not configured</p>
                  <p className="mt-1">Add RESTORE_STAGING_DATABASE_URL in Vercel and GitHub Actions before queuing restore validation.</p>
                </div>
              )}
              {restoreTarget?.last_validation && (
                <div className="rounded-xl border border-[#E6EDE9] bg-ivory px-4 py-3 text-[13px] text-muted-green">
                  <p className="font-semibold text-forest">Latest validation: <span className="capitalize">{restoreTarget.last_validation.status}</span></p>
                  {restoreTarget.last_validation.staging_target && <p>Staging: {restoreTarget.last_validation.staging_target}</p>}
                  {restoreTarget.last_validation.error_message && <p className="text-red-700">{restoreTarget.last_validation.error_message}</p>}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="restore-confirm">Type RESTORE to confirm staged validation</Label>
                <Input id="restore-confirm" value={restoreConfirm} onChange={(event) => setRestoreConfirm(event.target.value)} className="rounded-xl border-[#DCEBE5] bg-ivory" />
              </div>
              <DialogFooter className="flex-col gap-2 pt-2 sm:flex-row">
                <Button variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green" onClick={() => setRestoreTarget(null)}>Cancel</Button>
                <Button variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green hover:bg-soft-green hover:text-forest" onClick={requestCutover} disabled={busy === 'cutover'}>
                  {busy === 'cutover' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Cutover steps
                </Button>
                <Button className="gradient-btn rounded-full" onClick={queueValidation} disabled={!configured.staging || restoreConfirm !== 'RESTORE' || busy === 'validate'}>
                  {busy === 'validate' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Queue staged validation
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="border-[#E6EDE9] bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-forest">Delete backup?</DialogTitle>
            <DialogDescription>
              This removes the encrypted file and manifest from Google Drive and marks the record deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
            <Input id="delete-confirm" value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} className="rounded-xl border-[#DCEBE5] bg-ivory" />
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button className="rounded-full bg-red-600 text-white hover:bg-red-700" onClick={deleteBackup} disabled={deleteConfirm !== 'DELETE' || busy === 'delete'}>
              {busy === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete backup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(archiveDeleteTarget)} onOpenChange={(open) => { if (!open) { setArchiveDeleteTarget(null); setArchiveDeleteConfirm(''); } }}>
        <DialogContent className="border-[#E6EDE9] bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-forest">Approve research deletion?</DialogTitle>
            <DialogDescription>
              {archiveDeleteTarget ? `This will delete ${archiveDeleteTarget.research_count} approved/rejected research records from ${archiveDeleteTarget.year} after the worker re-verifies the archive and current records. Author profiles and users are kept.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
              A completed full database backup within 48 hours is required. If any archived research changed, deletion is blocked and a new archive is needed.
            </div>
            <div className="space-y-2">
              <Label htmlFor="archive-delete-confirm">Type {archiveDeleteTarget ? `DELETE-YEAR ${archiveDeleteTarget.year}` : 'DELETE-YEAR <year>'} to confirm</Label>
              <Input id="archive-delete-confirm" value={archiveDeleteConfirm} onChange={(event) => setArchiveDeleteConfirm(event.target.value)} className="rounded-xl border-[#DCEBE5] bg-ivory" />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green" onClick={() => setArchiveDeleteTarget(null)}>Cancel</Button>
            <Button className="rounded-full bg-red-600 text-white hover:bg-red-700" onClick={approveArchiveDelete} disabled={busy === 'archive-delete' || !archiveDeleteTarget || archiveDeleteConfirm !== `DELETE-YEAR ${archiveDeleteTarget.year}`}>
              {busy === 'archive-delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Approve deletion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(archiveRestoreTarget)} onOpenChange={(open) => { if (!open) { setArchiveRestoreTarget(null); setArchiveRestoreConfirm(''); } }}>
        <DialogContent className="border-[#E6EDE9] bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-forest">Restore yearly archive?</DialogTitle>
            <DialogDescription>
              {archiveRestoreTarget ? `This restores missing research from ${archiveRestoreTarget.year}. Existing codes are skipped; related programs and authors are matched by code or name.` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="archive-restore-confirm">Type {archiveRestoreTarget ? `RESTORE-YEAR ${archiveRestoreTarget.year}` : 'RESTORE-YEAR <year>'} to confirm</Label>
            <Input id="archive-restore-confirm" value={archiveRestoreConfirm} onChange={(event) => setArchiveRestoreConfirm(event.target.value)} className="rounded-xl border-[#DCEBE5] bg-ivory" />
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" className="rounded-full border-[#DCEBE5] text-[13px] font-semibold text-muted-green" onClick={() => setArchiveRestoreTarget(null)}>Cancel</Button>
            <Button className="gradient-btn rounded-full" onClick={restoreYearArchive} disabled={busy === 'archive-restore' || !archiveRestoreTarget || archiveRestoreConfirm !== `RESTORE-YEAR ${archiveRestoreTarget.year}`}>
              {busy === 'archive-restore' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />} Queue restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(validationTarget)} onOpenChange={(open) => { if (!open) setValidationTarget(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto border-[#E6EDE9] bg-white sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-forest">Restore validation checks</DialogTitle>
            <DialogDescription>{validationTarget?.file_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant={statusVariant(validationTarget?.last_validation?.status)} className="capitalize">{validationTarget?.last_validation?.status}</Badge>
              {validationTarget?.last_validation?.staging_target && <span className="text-[12.5px] text-muted-green">Staging: {validationTarget.last_validation.staging_target}</span>}
            </div>
            {validationTarget?.last_validation?.error_message && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{validationTarget.last_validation.error_message}</p>
            )}
            <pre className="max-h-[55vh] overflow-auto rounded-xl bg-[#093227] p-4 text-[11.5px] leading-relaxed text-[#DFF3EA]">
              {JSON.stringify(validationTarget?.last_validation?.checks || {}, null, 2)}
            </pre>
          </div>
          <DialogFooter>
            <Button className="gradient-btn rounded-full" onClick={() => setValidationTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
