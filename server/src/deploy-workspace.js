import fs from 'node:fs';
import path from 'node:path';
import { loadRepos } from './config.js';
import { git } from './deploy-git.js';

const MAX_DIFF_CHARS = 120_000;

function repoCwd(repoKey) {
  const { repos } = loadRepos();
  const hit = repos[repoKey];
  if (!hit) throw new Error(`未找到仓库: ${repoKey}`);
  return { cwd: hit.absPath, label: hit.label };
}

/** @returns {{ path: string, x: string, y: string, staged: boolean, unstaged: boolean, status: string }[]} */
function parsePorcelain(out) {
  const files = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const xy = line.slice(0, 2);
    let rest = line.slice(3);
    let path = rest;
    let orig = '';
    const rename = /^(.+) -> (.+)$/.exec(rest);
    if (rename) {
      orig = rename[1];
      path = rename[2];
    }
    const x = xy[0] || ' ';
    const y = xy[1] || ' ';
    const staged = x !== ' ' && x !== '?';
    const unstaged = y !== ' ' && y !== '?';
    let status = 'modified';
    if (x === '?' || y === '?') status = 'untracked';
    else if (x === 'A' || y === 'A') status = 'added';
    else if (x === 'D' || y === 'D') status = 'deleted';
    else if (x === 'R' || y === 'R') status = 'renamed';
    files.push({ path, orig, x, y, staged, unstaged, status });
  }
  return files;
}

export async function getDeployWorkspace(repoKey) {
  const { cwd, label } = repoCwd(repoKey);
  await git(cwd, ['rev-parse', '--git-dir']);
  const branch = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const shortHash = await git(cwd, ['rev-parse', '--short', 'HEAD']);
  const porcelain = await git(cwd, ['status', '--porcelain', '-u']);
  const files = parsePorcelain(porcelain);
  const staged = files.filter((f) => f.staged);
  const unstaged = files.filter((f) => f.unstaged || f.status === 'untracked');
  return {
    ok: true,
    repoKey,
    label,
    branch,
    shortHash,
    clean: files.length === 0,
    files,
    staged,
    unstaged,
    counts: {
      staged: staged.length,
      unstaged: unstaged.length,
      total: files.length,
    },
  };
}

export async function getDeployFileDiff(repoKey, relPath, mode = 'auto') {
  const { cwd } = repoCwd(repoKey);
  const fileRel = String(relPath ?? '').trim();
  if (!fileRel) throw new Error('path required');

  let args;
  if (mode === 'staged') args = ['diff', '--cached', '--', fileRel];
  else if (mode === 'unstaged') args = ['diff', '--', fileRel];
  else {
    const staged = await git(cwd, ['diff', '--cached', '--name-only', '--', fileRel]).catch(() => '');
    args = staged.trim() ? ['diff', '--cached', '--', fileRel] : ['diff', '--', fileRel];
  }

  let diff = '';
  try {
    diff = await git(cwd, args, { maxBuffer: 8 * 1024 * 1024 });
  } catch {
    diff = '';
  }
  if (!diff && mode !== 'staged') {
    const untracked = await git(cwd, ['ls-files', '--others', '--exclude-standard', '--', fileRel]).catch(() => '');
    if (untracked.trim()) {
      const abs = path.join(cwd, fileRel);
      if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
        const text = fs.readFileSync(abs, 'utf8');
        const lines = text.split(/\r?\n/);
        const preview = lines.slice(0, 800);
        diff = `--- /dev/null\n+++ b/${fileRel}\n@@ 新文件（未跟踪）@@\n`;
        for (const ln of preview) diff += `+${ln}\n`;
        if (lines.length > 800) diff += `\n…（文件过大，仅预览前 800 行）`;
      }
    }
  }

  if (diff.length > MAX_DIFF_CHARS) {
    diff = `${diff.slice(0, MAX_DIFF_CHARS)}\n\n…（diff 过长，已截断）`;
  }

  return { ok: true, repoKey, path: fileRel, mode, diff: diff || '' };
}

export async function setDeployFileStage(repoKey, relPath, stage) {
  const { cwd } = repoCwd(repoKey);
  const fileRel = String(relPath ?? '').trim();
  if (!fileRel) throw new Error('path required');
  if (stage) await git(cwd, ['add', '--', fileRel]);
  else await git(cwd, ['restore', '--staged', '--', fileRel]).catch(async () => {
    await git(cwd, ['reset', 'HEAD', '--', fileRel]);
  });
  return getDeployWorkspace(repoKey);
}