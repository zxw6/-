import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { insertWipSnapshot } from './db.js';
import { summarizeWipFile } from './summarize.js';

const execFileAsync = promisify(execFile);

export function startWipSnapshots({ repos, db, onEvent, intervalMs = 120_000 }) {
  const lastFingerprint = new Map();

  const tick = async () => {
    for (const repo of Object.values(repos)) {
      try {
        const raw = await collectDirtyFiles(repo.absPath);
        if (raw.length === 0) continue;
        const files = raw.map((f) => ({
          ...f,
          summary: summarizeWipFile(f.path, f.insertions, f.deletions, f.status),
        }));
        const fp = files.map((f) => `${f.path}|${f.insertions}|${f.deletions}`).join('\n');
        if (lastFingerprint.get(repo.key) === fp) continue;
        lastFingerprint.set(repo.key, fp);
        const ts = Date.now();
        const row = {
          repo_key: repo.key,
          ts,
          file_count: files.length,
          files_json: JSON.stringify(files),
        };
        insertWipSnapshot(db, row);
        onEvent?.({ type: 'snapshot', ...row, files });
      } catch {
        /* 非 git 目录等 */
      }
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  return () => clearInterval(timer);
}

async function collectDirtyFiles(cwd) {
  const files = [];
  try {
    const { stdout: unstaged } = await execFileAsync(
      'git',
      ['diff', '--numstat', 'HEAD'],
      { cwd, maxBuffer: 4 * 1024 * 1024 },
    );
    parseNumstat(unstaged, files);
  } catch {
    return [];
  }
  try {
    const { stdout: staged } = await execFileAsync(
      'git',
      ['diff', '--numstat', '--cached'],
      { cwd, maxBuffer: 4 * 1024 * 1024 },
    );
    parseNumstat(staged, files, 'staged');
  } catch {
    /* ignore */
  }
  try {
    const { stdout: untracked } = await execFileAsync(
      'git',
      ['ls-files', '--others', '--exclude-standard'],
      { cwd, maxBuffer: 4 * 1024 * 1024 },
    );
    for (const line of untracked.split('\n')) {
      const p = line.trim();
      if (p) files.push({ path: p.replace(/\\/g, '/'), insertions: 0, deletions: 0, status: 'untracked' });
    }
  } catch {
    /* ignore */
  }
  const byPath = new Map();
  for (const f of files) {
    const prev = byPath.get(f.path);
    if (!prev) byPath.set(f.path, f);
    else {
      byPath.set(f.path, {
        ...prev,
        insertions: prev.insertions + f.insertions,
        deletions: prev.deletions + f.deletions,
      });
    }
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function parseNumstat(text, out, status = 'modified') {
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    const [ins, del, filePath] = parts;
    out.push({
      path: filePath.replace(/\\/g, '/'),
      insertions: ins === '-' ? 0 : Number(ins) || 0,
      deletions: del === '-' ? 0 : Number(del) || 0,
      status,
    });
  }
}