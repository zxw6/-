import fs from 'node:fs';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';
import { loadRepos, saveMonitorConfig, readMonitorConfig, CONFIG_PATH, DATA_DIR } from './config.js';
import {
  openDb,
  yearStatsSummary,
  eventsForDay,
  recentTimeline,
  getWorkLog,
  saveWorkLog,
  listWorkMemos,
  getWorkMemo,
  createWorkMemo,
  updateWorkMemo,
  deleteWorkMemo,
} from './db.js';
import { startWatchers } from './watcher.js';
import { startWipSnapshots } from './git-snapshot.js';
import {
  loadProfile,
  saveProfile,
  saveAvatarFromDataUrl,
  avatarAbsPath,
} from './profile.js';
import { pickFolderDialog, openFolderInExplorer } from './pick-folder.js';
import { fetchWeatherForCity, fetchWeatherForCoords } from './weather.js';
import {
  syncGitSubmissionsFromRepos,
  recordDeployGitSubmission,
  getGitSubmissions,
} from './git-submissions.js';
import { readDeployConfig, saveDeployConfig, upsertDeployTargetForRepo, DEPLOY_CONFIG_PATH } from './deploy-config.js';
import { openPathInExplorer, openFileWithDefaultApp } from './pick-folder.js';
import { runDeployTarget, getRemotesForRepo } from './deploy-runner.js';
import { getDeployDrafts, restoreDeployDraft, removeDeployDraft } from './deploy-drafts.js';
import { getDeployWorkspace, getDeployFileDiff, setDeployFileStage } from './deploy-workspace.js';
import { applyGitRemote } from './deploy-remotes.js';
import { listDeployProjects } from './deploy-projects.js';

const PORT = Number(process.env.CODE_WORKBENCH_PORT ?? 4177);
const ALLOWED_LOCALES = new Set(['zh-CN', 'en-US']);
const messagesLocale = (loc) => ALLOWED_LOCALES.has(loc);

const db = openDb();
const clients = new Set();

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(data);
  }
}

const onEvent = (payload) => broadcast({ channel: 'activity', payload });

let monitoring = (() => {
  const loaded = loadRepos();
  const profile = loadProfile();
  let stopWatch = startWatchers({ repos: loaded.repos, db, onEvent });
  let stopSnap = startWipSnapshots({
    repos: loaded.repos,
    db,
    onEvent,
    intervalMs: loaded.snapshotIntervalSeconds * 1000,
  });
  return {
    repos: loaded.repos,
    snapshotIntervalSeconds: loaded.snapshotIntervalSeconds,
    stopWatch,
    stopSnap,
    displayName: profile.nickname || profile.username,
  };
})();

function reloadMonitoring() {
  monitoring.stopWatch();
  monitoring.stopSnap();
  const loaded = loadRepos();
  monitoring.repos = loaded.repos;
  monitoring.snapshotIntervalSeconds = loaded.snapshotIntervalSeconds;
  monitoring.stopWatch = startWatchers({ repos: loaded.repos, db, onEvent });
  monitoring.stopSnap = startWipSnapshots({
    repos: loaded.repos,
    db,
    onEvent,
    intervalMs: loaded.snapshotIntervalSeconds * 1000,
  });
  broadcast({ channel: 'monitoring', payload: { reloaded: true } });
  return loaded;
}

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get('/api/health', async () => ({
  ok: true,
  profile: loadProfile(),
  configPath: CONFIG_PATH,
  dataDir: DATA_DIR,
  repoCount: Object.keys(monitoring.repos).length,
}));

app.get('/api/repos', async () => {
  const profile = loadProfile();
  return {
    workspace: profile.nickname || profile.username,
    configPath: CONFIG_PATH,
    dataDir: DATA_DIR,
    repos: Object.values(monitoring.repos).map((r) => ({
      key: r.key,
      label: r.label,
      purpose: r.purpose,
      path: r.absPath,
    })),
  };
});

app.get('/api/settings', async () => ({
  profile: loadProfile(),
  monitor: readMonitorConfig(),
  configPath: CONFIG_PATH,
}));

app.get('/api/weather', async (req) => {
  const profile = loadProfile();
  const lang = profile.locale?.startsWith('zh') ? 'zh' : 'en';
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  try {
    let data;
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      data = await fetchWeatherForCoords(lat, lon, lang);
    } else {
      const qCity = String(req.query.city ?? '').trim();
      const city = qCity || String(profile.city ?? '').trim();
      data = await fetchWeatherForCity(city, lang);
    }
    return { ok: true, ...data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.put('/api/settings/profile', async (req) => {
  const body = req.body ?? {};
  const loc = String(body.locale ?? '').trim();
  const th = String(body.theme ?? '').trim();
  const prev = loadProfile();
  const patch = {
    username: String(body.username ?? '').trim() || 'developer',
    nickname: String(body.nickname ?? '').trim(),
    bio: String(body.bio ?? '').trim(),
    ...(messagesLocale(loc) ? { locale: loc } : {}),
    ...(th === 'light' || th === 'dark' ? { theme: th } : {}),
  };
  if (body.city !== undefined) {
    const c = String(body.city ?? '').trim();
    patch.city = c || prev.city || '厦门';
  }
  if (body.weatherAutoLocate !== undefined) {
    patch.weatherAutoLocate = body.weatherAutoLocate === true || body.weatherAutoLocate === 'true';
  }
  if (body.weatherLat !== undefined && body.weatherLat !== null && body.weatherLat !== '') {
    const v = Number(body.weatherLat);
    if (Number.isFinite(v)) patch.weatherLat = v;
  }
  if (body.weatherLon !== undefined && body.weatherLon !== null && body.weatherLon !== '') {
    const v = Number(body.weatherLon);
    if (Number.isFinite(v)) patch.weatherLon = v;
  }
  const profile = saveProfile(patch);
  if (body.avatarDataUrl) {
    try {
      saveAvatarFromDataUrl(body.avatarDataUrl);
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  return { ok: true, profile: loadProfile() };
});

app.put('/api/settings/monitor', async (req) => {
  const body = req.body ?? {};
  const repositories = Array.isArray(body.repositories) ? body.repositories : [];
  const snapshotIntervalSeconds = Number(body.snapshotIntervalSeconds) || 120;
  const monitor = saveMonitorConfig({
    snapshotIntervalSeconds,
    repositories: repositories.map((r) => ({
      key: String(r.key ?? '').trim(),
      label: String(r.label ?? '').trim(),
      path: String(r.path ?? '').trim(),
      note: String(r.note ?? '').trim(),
    })).filter((r) => r.key && r.path),
  });
  reloadMonitoring();
  return { ok: true, monitor };
});

app.post('/api/pick-folder', async (req) => {
  const currentPath = String(req.body?.currentPath ?? '').trim();
  try {
    const picked = await pickFolderDialog(currentPath);
    return {
      ok: true,
      path: picked ? picked.replace(/\\/g, '/') : null,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.post('/api/open-folder', async (req) => {
  const folderPath = String(req.body?.path ?? '').trim();
  if (!folderPath) return { ok: false, error: 'path required' };
  try {
    await openFolderInExplorer(folderPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.get('/api/avatar', async (req, reply) => {
  const profile = loadProfile();
  const abs = avatarAbsPath(profile.avatarFile);
  if (!abs) {
    return reply.code(404).send({ error: 'no avatar' });
  }
  const ext = abs.split('.').pop()?.toLowerCase();
  const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
  reply.header('Content-Type', types[ext] ?? 'application/octet-stream');
  return reply.send(fs.createReadStream(abs));
});

app.get('/api/stats/:year', async (req) => {
  const year = Number(req.params.year);
  if (!Number.isFinite(year)) return { error: 'invalid year' };
  return yearStatsSummary(db, year);
});

app.get('/api/day/:date', async (req) => {
  const date = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: 'date must be YYYY-MM-DD' };
  return eventsForDay(db, date);
});

app.get('/api/timeline', async (req) => {
  const limit = Number(req.query.limit ?? 100);
  return { items: recentTimeline(db, limit) };
});

function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

app.get('/api/work-log', async (req) => {
  const q = String(req.query.date ?? '').trim();
  const dayKey = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : localDayKey();
  const row = getWorkLog(db, dayKey);
  if (!row) return { ok: false, error: 'invalid date' };
  return { ok: true, ...row };
});

app.put('/api/work-log', async (req) => {
  const body = req.body ?? {};
  const dayKey = String(body.date ?? body.dayKey ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return { ok: false, error: 'date must be YYYY-MM-DD' };
  try {
    const row = saveWorkLog(db, dayKey, body.content);
    return { ok: true, ...row };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.get('/api/work-memos', async () => ({ ok: true, items: listWorkMemos(db) }));

app.post('/api/work-memos', async (req) => {
  const body = req.body ?? {};
  try {
    const row = createWorkMemo(db, body.title, body.content, body.boardStatus);
    return { ok: true, memo: row };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.get('/api/work-memos/:id', async (req) => {
  const row = getWorkMemo(db, req.params.id);
  if (!row) return { ok: false, error: 'not found' };
  return { ok: true, memo: row };
});

app.put('/api/work-memos/:id', async (req) => {
  const body = req.body ?? {};
  try {
    const row = updateWorkMemo(db, req.params.id, {
      title: body.title,
      content: body.content,
      boardStatus: body.boardStatus,
    });
    return { ok: true, memo: row };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.get('/api/git-submissions', async (req) => {
  const limit = Number(req.query.limit ?? 80);
  const repoKey = String(req.query.repoKey ?? '').trim();
  const doSync = req.query.sync === '1' || req.query.sync === 'true';
  if (doSync) await syncGitSubmissionsFromRepos(db);
  return { ok: true, items: getGitSubmissions(db, { limit, repoKey }) };
});

app.post('/api/git-submissions', async (req) => {
  const body = req.body ?? {};
  try {
    const row = recordDeployGitSubmission(db, body);
    return { ok: true, item: row };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.post('/api/git-submissions/sync', async () => {
  try {
    const stats = await syncGitSubmissionsFromRepos(db);
    return { ok: true, ...stats, items: getGitSubmissions(db, { limit: 100 }) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.get('/api/deploy/config', async () => ({ ok: true, ...readDeployConfig() }));

app.get('/api/deploy/overview', async () => {
  const cfg = readDeployConfig();
  const projects = listDeployProjects();
  const items = getGitSubmissions(db, { limit: 400 }).filter((s) => s.action === 'deploy');
  const metaById = {};
  for (const p of projects) {
    const last = items.find((s) => s.repoKey === p.repoKey);
    metaById[p.id] = {
      localPath: p.localPath ?? '',
      lastDeployAt: last?.committedAt ?? null,
      lastDeployShort: last?.shortHash ?? '',
      lastDeployMessage: last?.message ?? '',
    };
  }
  return {
    ok: true,
    configPath: cfg.configPath,
    defaults: cfg.defaults,
    targets: cfg.targets,
    projects,
    metaById,
  };
});

app.put('/api/deploy/config', async (req) => {
  const body = req.body ?? {};
  const saved = saveDeployConfig(body);
  return { ok: true, ...saved };
});

app.put('/api/deploy/target/:repoKey', async (req) => {
  const repoKey = String(req.params.repoKey ?? '').trim();
  const body = req.body ?? {};
  if (!repoKey) return { ok: false, error: 'repoKey required' };
  try {
    const saved = upsertDeployTargetForRepo(repoKey, body);
    return { ok: true, ...saved, projects: listDeployProjects() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.post('/api/deploy/open-config', async (req) => {
  const body = req.body ?? {};
  const mode = String(body.mode ?? 'explorer');
  try {
    readDeployConfig();
    if (mode === 'edit') await openFileWithDefaultApp(DEPLOY_CONFIG_PATH);
    else await openPathInExplorer(DEPLOY_CONFIG_PATH);
    return { ok: true, path: DEPLOY_CONFIG_PATH };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.post('/api/deploy/run', async (req) => {
  const body = req.body ?? {};
  const targetId = String(body.targetId ?? '').trim();
  const repoKey = String(body.repoKey ?? '').trim();
  if (!targetId && !repoKey) return { ok: false, error: '请选择项目（targetId 或 repoKey）' };
  try {
    const result = await runDeployTarget(db, targetId || `repo:${repoKey}`, {
      commitMessage: body.commitMessage,
      push: body.push !== false,
      allowCommit: body.allowCommit !== false,
      branch: body.branch,
      gitRemote: body.gitRemote,
      gitHost: body.gitHostOverride === true ? body.gitHost : '',
      repoKey: repoKey || undefined,
    });
    return result;
  } catch (e) {
    return { ok: false, error: e.message, logs: e.logs ?? [] };
  }
});

app.get('/api/deploy/workspace', async (req) => {
  const repoKey = String(req.query.repoKey ?? '').trim();
  if (!repoKey) return { ok: false, error: 'repoKey required' };
  try {
    return await getDeployWorkspace(repoKey);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.get('/api/deploy/diff', async (req) => {
  const repoKey = String(req.query.repoKey ?? '').trim();
  const filePath = String(req.query.path ?? '').trim();
  const mode = String(req.query.mode ?? 'auto');
  if (!repoKey || !filePath) return { ok: false, error: 'repoKey and path required' };
  try {
    return await getDeployFileDiff(repoKey, filePath, mode);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.post('/api/deploy/workspace/stage', async (req) => {
  const body = req.body ?? {};
  const repoKey = String(body.repoKey ?? '').trim();
  const filePath = String(body.path ?? '').trim();
  if (!repoKey || !filePath) return { ok: false, error: 'repoKey and path required' };
  try {
    return await setDeployFileStage(repoKey, filePath, body.stage !== false);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.get('/api/deploy/remotes', async (req) => {
  const repoKey = String(req.query.repoKey ?? '').trim();
  if (!repoKey) return { ok: false, error: 'repoKey required' };
  try {
    return await getRemotesForRepo(repoKey);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.post('/api/deploy/remotes', async (req) => {
  const body = req.body ?? {};
  const repoKey = String(body.repoKey ?? '').trim();
  const remoteName = String(body.remoteName ?? body.name ?? 'origin').trim();
  const url = String(body.url ?? '').trim();
  if (!repoKey || !url) return { ok: false, error: 'repoKey 与 url 必填' };
  try {
    return await applyGitRemote(repoKey, remoteName, url);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.get('/api/deploy/drafts', async (req) => {
  const repoKey = String(req.query.repoKey ?? '').trim();
  const items = getDeployDrafts(db, repoKey);
  return { ok: true, items };
});

app.post('/api/deploy/drafts/:id/restore', async (req) => {
  const id = req.params.id;
  try {
    return await restoreDeployDraft(db, id);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.delete('/api/deploy/drafts/:id', async (req) => {
  try {
    return removeDeployDraft(db, req.params.id);
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

app.delete('/api/work-memos/:id', async (req) => {
  try {
    deleteWorkMemo(db, req.params.id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

await app.listen({ port: PORT, host: '127.0.0.1' });

const wss = new WebSocketServer({ server: app.server, path: '/ws' });
wss.on('connection', (ws) => {
  clients.add(ws);
  ws.on('close', () => clients.delete(ws));
  const p = loadProfile();
  ws.send(JSON.stringify({ channel: 'hello', workspace: p.nickname || p.username }));
});

const shutdown = () => {
  monitoring.stopWatch();
  monitoring.stopSnap();
  db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const p = loadProfile();
console.log(`[code-workbench] ${p.nickname || p.username}`);
console.log(`  配置 ${CONFIG_PATH}`);
console.log(`  数据 ${DATA_DIR}`);
console.log(`  界面 http://127.0.0.1:5178`);
console.log(`  API  http://127.0.0.1:${PORT}`);