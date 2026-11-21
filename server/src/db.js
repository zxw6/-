import fs from 'node:fs';
import Database from 'better-sqlite3';
import { DATA_DIR, DB_PATH } from './config.js';

export function openDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS file_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_key TEXT NOT NULL,
      rel_path TEXT NOT NULL,
      kind TEXT NOT NULL,
      ts INTEGER NOT NULL,
      size INTEGER
    );
    CREATE TABLE IF NOT EXISTS wip_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_key TEXT NOT NULL,
      ts INTEGER NOT NULL,
      file_count INTEGER NOT NULL,
      files_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_file_events_ts ON file_events(ts);
    CREATE INDEX IF NOT EXISTS idx_file_events_repo ON file_events(repo_key);
    CREATE INDEX IF NOT EXISTS idx_wip_snapshots_ts ON wip_snapshots(ts);
    CREATE TABLE IF NOT EXISTS work_logs (
      day_key TEXT PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS work_memos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL DEFAULT '',
      board_status TEXT NOT NULL DEFAULT 'todo',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_work_memos_updated ON work_memos(updated_at DESC);
    CREATE TABLE IF NOT EXISTS git_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_key TEXT NOT NULL DEFAULT '',
      repo_label TEXT NOT NULL DEFAULT '',
      author_name TEXT NOT NULL DEFAULT '',
      author_email TEXT NOT NULL DEFAULT '',
      git_account TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      action TEXT NOT NULL DEFAULT 'commit',
      branch TEXT NOT NULL DEFAULT '',
      merge_from TEXT NOT NULL DEFAULT '',
      merge_into TEXT NOT NULL DEFAULT '',
      commit_hash TEXT NOT NULL DEFAULT '',
      short_hash TEXT NOT NULL DEFAULT '',
      committed_at INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'sync',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_git_submissions_ts ON git_submissions(committed_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_git_submissions_hash ON git_submissions(repo_key, commit_hash);
    CREATE TABLE IF NOT EXISTS deploy_drafts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      repo_key TEXT NOT NULL,
      repo_label TEXT NOT NULL DEFAULT '',
      target_id TEXT NOT NULL DEFAULT '',
      head_hash TEXT NOT NULL,
      short_hash TEXT NOT NULL DEFAULT '',
      branch TEXT NOT NULL DEFAULT '',
      wip_commit TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_deploy_drafts_repo ON deploy_drafts(repo_key, created_at DESC);
  `);
  try {
    db.exec(`ALTER TABLE file_events ADD COLUMN summary TEXT`);
  } catch {
    /* 已存在 */
  }
  try {
    db.exec(`ALTER TABLE work_memos ADD COLUMN board_status TEXT NOT NULL DEFAULT 'todo'`);
  } catch {
    /* 已存在 */
  }
  return db;
}

const BOARD_STATUSES = new Set(['todo', 'doing', 'done']);

function normalizeBoardStatus(v) {
  const s = String(v ?? 'todo').trim();
  return BOARD_STATUSES.has(s) ? s : 'todo';
}

function mapMemoRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    boardStatus: normalizeBoardStatus(row.board_status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function insertFileEvent(db, row) {
  const stmt = db.prepare(`
    INSERT INTO file_events (repo_key, rel_path, kind, ts, size, summary)
    VALUES (@repo_key, @rel_path, @kind, @ts, @size, @summary)
  `);
  return stmt.run(row);
}

export function insertWipSnapshot(db, row) {
  const stmt = db.prepare(`
    INSERT INTO wip_snapshots (repo_key, ts, file_count, files_json)
    VALUES (@repo_key, @ts, @file_count, @files_json)
  `);
  return stmt.run(row);
}

export function dailyCountsForYear(db, year) {
  const start = Date.parse(`${year}-01-01T00:00:00`);
  const end = Date.parse(`${year + 1}-01-01T00:00:00`);
  const events = db
    .prepare(`SELECT ts FROM file_events WHERE ts >= ? AND ts < ?`)
    .all(start, end);
  const snaps = db
    .prepare(`SELECT ts, file_count FROM wip_snapshots WHERE ts >= ? AND ts < ?`)
    .all(start, end);

  const byDay = new Map();
  const add = (ts, weight) => {
    const d = new Date(ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    byDay.set(key, (byDay.get(key) ?? 0) + weight);
  };
  for (const e of events) add(e.ts, 1);
  for (const s of snaps) add(s.ts, Math.min(5, 1 + Math.floor(s.file_count / 3)));

  return byDay;
}

export function eventsForDay(db, dayKey) {
  const start = Date.parse(`${dayKey}T00:00:00`);
  const end = start + 86400000;
  const fileEvents = db
    .prepare(
      `
    SELECT id, repo_key, rel_path, kind, ts, size, summary
    FROM file_events
    WHERE ts >= ? AND ts < ?
    ORDER BY ts DESC
  `,
    )
    .all(start, end);
  const snapshots = db
    .prepare(
      `
    SELECT id, repo_key, ts, file_count, files_json
    FROM wip_snapshots
    WHERE ts >= ? AND ts < ?
    ORDER BY ts DESC
  `,
    )
    .all(start, end);
  return { fileEvents, snapshots };
}

export function recentTimeline(db, limit = 80) {
  const files = db
    .prepare(
      `
    SELECT 'file' AS type, id, repo_key, rel_path AS detail, kind, ts, summary AS extra
    FROM file_events
    ORDER BY ts DESC
    LIMIT ?
  `,
    )
    .all(limit);
  const snaps = db
    .prepare(
      `
    SELECT 'snapshot' AS type, id, repo_key, CAST(file_count AS TEXT) AS detail, 'wip' AS kind, ts, files_json AS extra
    FROM wip_snapshots
    ORDER BY ts DESC
    LIMIT ?
  `,
    )
    .all(Math.floor(limit / 3));
  return [...files, ...snaps].sort((a, b) => b.ts - a.ts).slice(0, limit);
}

export function yearStatsSummary(db, year) {
  const counts = dailyCountsForYear(db, year);
  let total = 0;
  for (const v of counts.values()) total += v;
  return { year, totalContributions: total, byDay: Object.fromEntries(counts) };
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getWorkLog(db, dayKey) {
  if (!DAY_KEY_RE.test(dayKey)) return null;
  const row = db.prepare(`SELECT content, updated_at FROM work_logs WHERE day_key = ?`).get(dayKey);
  return {
    dayKey,
    content: row?.content ?? '',
    updatedAt: row?.updated_at ?? null,
  };
}

export function saveWorkLog(db, dayKey, content) {
  if (!DAY_KEY_RE.test(dayKey)) throw new Error('date must be YYYY-MM-DD');
  const text = String(content ?? '');
  const updatedAt = Date.now();
  db.prepare(
    `
    INSERT INTO work_logs (day_key, content, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(day_key) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at
  `,
  ).run(dayKey, text, updatedAt);
  return { dayKey, content: text, updatedAt };
}

function ensureWorkMemosMigrated(db) {
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM work_memos`).get();
  if (n > 0) return;
  const logs = db
    .prepare(`SELECT day_key, content, updated_at FROM work_logs WHERE length(trim(content)) > 0 ORDER BY day_key DESC`)
    .all();
  if (!logs.length) return;
  const ins = db.prepare(
    `INSERT INTO work_memos (title, content, board_status, created_at, updated_at) VALUES (?, ?, 'todo', ?, ?)`,
  );
  for (const row of logs) {
    ins.run(row.day_key, row.content, row.updated_at, row.updated_at);
  }
}

export function listWorkMemos(db) {
  ensureWorkMemosMigrated(db);
  const rows = db
    .prepare(`SELECT id, title, content, board_status, created_at, updated_at FROM work_memos ORDER BY updated_at DESC`)
    .all();
  return rows.map(mapMemoRow);
}

export function getWorkMemo(db, id) {
  const nid = Number(id);
  if (!Number.isFinite(nid)) return null;
  const row = db
    .prepare(`SELECT id, title, content, board_status, created_at, updated_at FROM work_memos WHERE id = ?`)
    .get(nid);
  return mapMemoRow(row);
}

export function createWorkMemo(db, title, content, boardStatus = 'todo') {
  const now = Date.now();
  const t = String(title ?? '').trim();
  const c = String(content ?? '');
  const status = normalizeBoardStatus(boardStatus);
  const r = db
    .prepare(
      `INSERT INTO work_memos (title, content, board_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(t, c, status, now, now);
  return getWorkMemo(db, r.lastInsertRowid);
}

export function updateWorkMemo(db, id, patch) {
  const nid = Number(id);
  if (!Number.isFinite(nid)) throw new Error('invalid id');
  const prev = getWorkMemo(db, nid);
  if (!prev) throw new Error('not found');
  const title = patch.title !== undefined ? String(patch.title) : prev.title;
  const content = patch.content !== undefined ? String(patch.content) : prev.content;
  const boardStatus = patch.boardStatus !== undefined ? normalizeBoardStatus(patch.boardStatus) : prev.boardStatus;
  const updatedAt = Date.now();
  db.prepare(
    `UPDATE work_memos SET title = ?, content = ?, board_status = ?, updated_at = ? WHERE id = ?`,
  ).run(title, content, boardStatus, updatedAt, nid);
  return getWorkMemo(db, nid);
}

export function deleteWorkMemo(db, id) {
  const nid = Number(id);
  if (!Number.isFinite(nid)) throw new Error('invalid id');
  const prev = getWorkMemo(db, nid);
  if (!prev) throw new Error('not found');
  db.prepare(`DELETE FROM work_memos WHERE id = ?`).run(nid);
  return { id: nid };
}

function mapGitSubmissionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    repoKey: row.repo_key,
    repoLabel: row.repo_label,
    authorName: row.author_name,
    authorEmail: row.author_email,
    gitAccount: row.git_account,
    message: row.message,
    action: row.action,
    branch: row.branch,
    mergeFrom: row.merge_from,
    mergeInto: row.merge_into,
    commitHash: row.commit_hash,
    shortHash: row.short_hash,
    committedAt: row.committed_at,
    source: row.source,
    createdAt: row.created_at,
  };
}

export function gitSubmissionExists(db, repoKey, commitHash) {
  if (!commitHash) return false;
  const row = db
    .prepare(`SELECT 1 FROM git_submissions WHERE repo_key = ? AND commit_hash = ?`)
    .get(String(repoKey ?? ''), String(commitHash));
  return !!row;
}

export function recordGitSubmission(db, payload) {
  const now = Date.now();
  const repoKey = String(payload.repoKey ?? '');
  let commitHash = String(payload.commitHash ?? '');
  if (!commitHash && String(payload.source ?? '') === 'deploy') {
    commitHash = `deploy-${now}-${Math.random().toString(36).slice(2, 9)}`;
  }
  if (commitHash && gitSubmissionExists(db, repoKey, commitHash)) {
    const existing = db
      .prepare(`SELECT * FROM git_submissions WHERE repo_key = ? AND commit_hash = ?`)
      .get(repoKey, commitHash);
    return mapGitSubmissionRow(existing);
  }
  const committedAt = Number(payload.committedAt) || now;
  const r = db
    .prepare(
      `
    INSERT INTO git_submissions (
      repo_key, repo_label, author_name, author_email, git_account, message, action,
      branch, merge_from, merge_into, commit_hash, short_hash, committed_at, source, created_at
    ) VALUES (
      @repo_key, @repo_label, @author_name, @author_email, @git_account, @message, @action,
      @branch, @merge_from, @merge_into, @commit_hash, @short_hash, @committed_at, @source, @created_at
    )
  `,
    )
    .run({
      repo_key: repoKey,
      repo_label: String(payload.repoLabel ?? repoKey),
      author_name: String(payload.authorName ?? ''),
      author_email: String(payload.authorEmail ?? ''),
      git_account: String(payload.gitAccount ?? payload.authorEmail ?? payload.authorName ?? ''),
      message: String(payload.message ?? ''),
      action: String(payload.action ?? 'commit'),
      branch: String(payload.branch ?? ''),
      merge_from: String(payload.mergeFrom ?? ''),
      merge_into: String(payload.mergeInto ?? ''),
      commit_hash: commitHash,
      short_hash: String(payload.shortHash ?? commitHash.slice(0, 7)),
      committed_at: committedAt,
      source: String(payload.source ?? 'sync'),
      created_at: now,
    });
  const row = db.prepare(`SELECT * FROM git_submissions WHERE id = ?`).get(r.lastInsertRowid);
  return mapGitSubmissionRow(row);
}

export function listGitSubmissions(db, { limit = 100, repoKey = '' } = {}) {
  const n = Math.min(500, Math.max(1, Number(limit) || 100));
  const key = String(repoKey ?? '').trim();
  const rows = key
    ? db
        .prepare(
          `SELECT * FROM git_submissions WHERE repo_key = ? ORDER BY committed_at DESC LIMIT ?`,
        )
        .all(key, n)
    : db.prepare(`SELECT * FROM git_submissions ORDER BY committed_at DESC LIMIT ?`).all(n);
  return rows.map(mapGitSubmissionRow);
}

function mapDeployDraftRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    repoKey: row.repo_key,
    repoLabel: row.repo_label,
    targetId: row.target_id,
    headHash: row.head_hash,
    shortHash: row.short_hash,
    branch: row.branch,
    wipCommit: row.wip_commit,
    hasWip: Boolean(row.wip_commit),
    note: row.note,
    createdAt: row.created_at,
  };
}

export function insertDeployDraft(db, row) {
  if (row.id) {
    db.prepare(
      `UPDATE deploy_drafts SET wip_commit = ?, note = ? WHERE id = ?`,
    ).run(String(row.wipCommit ?? ''), String(row.note ?? ''), row.id);
    return mapDeployDraftRow(db.prepare(`SELECT * FROM deploy_drafts WHERE id = ?`).get(row.id));
  }
  const r = db
    .prepare(
      `
    INSERT INTO deploy_drafts (repo_key, repo_label, target_id, head_hash, short_hash, branch, wip_commit, note, created_at)
    VALUES (@repo_key, @repo_label, @target_id, @head_hash, @short_hash, @branch, @wip_commit, @note, @created_at)
  `,
    )
    .run({
      repo_key: String(row.repoKey ?? ''),
      repo_label: String(row.repoLabel ?? ''),
      target_id: String(row.targetId ?? ''),
      head_hash: String(row.headHash ?? ''),
      short_hash: String(row.shortHash ?? ''),
      branch: String(row.branch ?? ''),
      wip_commit: String(row.wipCommit ?? ''),
      note: String(row.note ?? ''),
      created_at: Number(row.createdAt) || Date.now(),
    });
  return mapDeployDraftRow(db.prepare(`SELECT * FROM deploy_drafts WHERE id = ?`).get(r.lastInsertRowid));
}

export function listDeployDrafts(db, repoKey, limit = 30) {
  const key = String(repoKey ?? '').trim();
  const rows = key
    ? db
        .prepare(`SELECT * FROM deploy_drafts WHERE repo_key = ? ORDER BY created_at DESC LIMIT ?`)
        .all(key, limit)
    : db.prepare(`SELECT * FROM deploy_drafts ORDER BY created_at DESC LIMIT ?`).all(limit);
  return rows.map(mapDeployDraftRow);
}

export function getDeployDraft(db, id) {
  const nid = Number(id);
  if (!Number.isFinite(nid)) return null;
  return mapDeployDraftRow(db.prepare(`SELECT * FROM deploy_drafts WHERE id = ?`).get(nid));
}

export function deleteDeployDraft(db, id) {
  db.prepare(`DELETE FROM deploy_drafts WHERE id = ?`).run(Number(id));
}

export function trimDeployDrafts(db, repoKey, maxKeep = 30) {
  const rows = db
    .prepare(`SELECT id FROM deploy_drafts WHERE repo_key = ? ORDER BY created_at DESC`)
    .all(repoKey);
  if (rows.length <= maxKeep) return;
  const toDelete = rows.slice(maxKeep);
  for (const { id } of toDelete) {
    deleteDeployDraft(db, id);
  }
}