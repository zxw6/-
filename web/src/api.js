export async function fetchRepos() {
  const res = await fetch('/api/repos');
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch('/api/settings');
  return res.json();
}

export async function fetchWeather(opts = {}) {
  const p = new URLSearchParams();
  const city = typeof opts === 'string' ? opts : opts.city;
  const lat = typeof opts === 'object' ? opts.lat : undefined;
  const lon = typeof opts === 'object' ? opts.lon : undefined;
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
    p.set('lat', String(lat));
    p.set('lon', String(lon));
  } else if (city) {
    p.set('city', String(city));
  }
  const qs = p.toString() ? `?${p}` : '';
  const res = await fetch(`/api/weather${qs}`);
  return res.json();
}

export async function fetchWorkLog(date) {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`/api/work-log${q}`);
  return res.json();
}

export async function saveWorkLog(date, content) {
  const res = await fetch('/api/work-log', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, content }),
  });
  return res.json();
}

export async function fetchWorkMemos() {
  const res = await fetch('/api/work-memos');
  return res.json();
}

export async function createWorkMemo(body = {}) {
  const res = await fetch('/api/work-memos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function updateWorkMemo(id, body) {
  const res = await fetch(`/api/work-memos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function fetchGitSubmissions(opts = {}) {
  const p = new URLSearchParams();
  if (opts.limit) p.set('limit', String(opts.limit));
  if (opts.repoKey) p.set('repoKey', opts.repoKey);
  if (opts.sync) p.set('sync', '1');
  const qs = p.toString() ? `?${p}` : '';
  const res = await fetch(`/api/git-submissions${qs}`);
  return res.json();
}

export async function syncGitSubmissions() {
  const res = await fetch('/api/git-submissions/sync', { method: 'POST' });
  return res.json();
}

export async function fetchDeployConfig() {
  const res = await fetch('/api/deploy/config');
  return res.json();
}

export async function fetchDeployOverview() {
  const res = await fetch('/api/deploy/overview');
  return res.json();
}

export async function runDeploy(body) {
  const res = await fetch('/api/deploy/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function fetchDeployRemotes(repoKey) {
  const p = new URLSearchParams({ repoKey });
  const res = await fetch(`/api/deploy/remotes?${p}`);
  return res.json();
}

export async function fetchDeployDrafts(repoKey = '') {
  const p = new URLSearchParams();
  if (repoKey) p.set('repoKey', repoKey);
  const qs = p.toString() ? `?${p}` : '';
  const res = await fetch(`/api/deploy/drafts${qs}`);
  return res.json();
}

export async function restoreDeployDraft(id) {
  const res = await fetch(`/api/deploy/drafts/${id}/restore`, { method: 'POST' });
  return res.json();
}

export async function deleteDeployDraft(id) {
  const res = await fetch(`/api/deploy/drafts/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function fetchDeployWorkspace(repoKey) {
  const p = new URLSearchParams({ repoKey });
  const res = await fetch(`/api/deploy/workspace?${p}`);
  return res.json();
}

export async function fetchDeployDiff(repoKey, path, mode = 'auto') {
  const p = new URLSearchParams({ repoKey, path, mode });
  const res = await fetch(`/api/deploy/diff?${p}`);
  return res.json();
}

export async function saveDeployTarget(repoKey, body) {
  const res = await fetch(`/api/deploy/target/${encodeURIComponent(repoKey)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function openDeployConfig(mode = 'explorer') {
  const res = await fetch('/api/deploy/open-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  return res.json();
}

export async function stageDeployFile(repoKey, path, stage = true) {
  const res = await fetch('/api/deploy/workspace/stage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoKey, path, stage }),
  });
  return res.json();
}

export async function postGitSubmission(body) {
  const res = await fetch('/api/git-submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function deleteWorkMemo(id) {
  const res = await fetch(`/api/work-memos/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function saveProfileSettings(body) {
  const res = await fetch('/api/settings/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function pickFolder(currentPath = '') {
  const res = await fetch('/api/pick-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPath }),
  });
  return res.json();
}

export async function openFolder(folderPath) {
  const res = await fetch('/api/open-folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: folderPath }),
  });
  return res.json();
}

export async function saveMonitorSettings(body) {
  const res = await fetch('/api/settings/monitor', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export function avatarUrl(withCache = true) {
  return withCache ? `/api/avatar?t=${Date.now()}` : '/api/avatar';
}

export async function fetchYearStats(year) {
  const res = await fetch(`/api/stats/${year}`);
  return res.json();
}

export async function fetchDay(date) {
  const res = await fetch(`/api/day/${date}`);
  return res.json();
}

export async function fetchTimeline(limit = 80) {
  const res = await fetch(`/api/timeline?limit=${limit}`);
  return res.json();
}

export function connectActivitySocket(onMessage) {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onmessage = (ev) => {
    try {
      onMessage(JSON.parse(ev.data));
    } catch {
      /* ignore */
    }
  };
  return ws;
}