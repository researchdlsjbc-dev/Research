const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {
  triggerWorkerWebhook,
  isGitHubDispatchUrl,
  buildWorkerTriggerPayload
} = require('../api/backup/notifications');

const ENV_KEYS = ['BACKUP_TRIGGER_WEBHOOK_URL', 'BACKUP_TRIGGER_WEBHOOK_TOKEN'];
const original = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function resetEnv() {
  for (const key of ENV_KEYS) {
    if (original[key] === undefined) delete process.env[key];
    else process.env[key] = original[key];
  }
}

test.after(resetEnv);

test('GitHub dispatch payload uses the repository_dispatch format', () => {
  const url = 'https://api.github.com/repos/temopoo5-cmyk/Research/dispatches';
  assert.equal(isGitHubDispatchUrl(url), true);

  const payload = buildWorkerTriggerPayload(url, new Date('2026-01-01T00:00:00Z'));
  assert.equal(payload.event_type, 'backup-requested');
  assert.equal(payload.client_payload.event, 'backup.worker.trigger');
  assert.equal(payload.client_payload.app, 'ResearchHub');
  assert.equal(payload.client_payload.at, '2026-01-01T00:00:00.000Z');
});

test('generic webhooks keep the existing trigger payload', () => {
  const url = 'https://example.com/hooks/backup';
  assert.equal(isGitHubDispatchUrl(url), false);

  const payload = buildWorkerTriggerPayload(url, new Date('2026-01-01T00:00:00Z'));
  assert.equal(payload.event, 'backup.worker.trigger');
  assert.equal(payload.event_type, undefined);
});

test('triggerWorkerWebhook posts the trigger payload with the token', async () => {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      requests.push({ headers: req.headers, body });
      res.writeHead(204);
      res.end();
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  process.env.BACKUP_TRIGGER_WEBHOOK_URL = `http://127.0.0.1:${port}/hook`;
  process.env.BACKUP_TRIGGER_WEBHOOK_TOKEN = 'test-token';

  try {
    const ok = await triggerWorkerWebhook();
    assert.equal(ok, true);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].headers.authorization, 'Bearer test-token');
    const payload = JSON.parse(requests[0].body);
    assert.equal(payload.event, 'backup.worker.trigger');
    assert.equal(payload.app, 'ResearchHub');
  } finally {
    await new Promise((resolve) => server.close(resolve));
    resetEnv();
  }
});
