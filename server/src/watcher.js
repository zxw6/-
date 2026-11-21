import fs from 'node:fs';
import path from 'node:path';
import chokidar from 'chokidar';
import { shouldIgnore } from './ignore.js';
import { insertFileEvent } from './db.js';
import { summarizeFileChange } from './summarize.js';

const debounceMs = 600;
const pending = new Map();

export function startWatchers({ repos, db, onEvent }) {
  const watchers = [];

  for (const repo of Object.values(repos)) {
    const watcher = chokidar.watch(repo.absPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
      ignored: (p) => shouldIgnore(p),
    });

    const schedule = (absPath, kind) => {
      if (shouldIgnore(absPath)) return;
      const rel = path.relative(repo.absPath, absPath).replace(/\\/g, '/');
      if (!rel || rel.startsWith('..')) return;

      const key = `${repo.key}:${rel}`;
      const existing = pending.get(key);
      if (existing) clearTimeout(existing.timer);

      const timer = setTimeout(() => {
        void (async () => {
          pending.delete(key);
          let size = null;
          try {
            size = fs.statSync(absPath).size;
          } catch {
            /* 删除等 */
          }
          const ts = Date.now();
          let summary = '';
          try {
            summary = await summarizeFileChange(repo.absPath, rel, kind);
          } catch {
            summary = kind === 'unlink' ? '删除文件' : '文件已保存';
          }
          const row = { repo_key: repo.key, rel_path: rel, kind, ts, size, summary };
          insertFileEvent(db, row);
          onEvent?.({ type: 'file', ...row });
        })();
      }, debounceMs);

      pending.set(key, { timer });
    };

    watcher.on('add', (p) => schedule(p, 'add'));
    watcher.on('change', (p) => schedule(p, 'change'));
    watcher.on('unlink', (p) => schedule(p, 'unlink'));

    watchers.push(watcher);
  }

  return () => {
    for (const w of watchers) void w.close();
    for (const { timer } of pending.values()) clearTimeout(timer);
    pending.clear();
  };
}