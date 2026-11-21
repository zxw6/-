import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const SCOPE_RULES = [
  [/pay|payment|wallet/i, 'pay'],
  [/trade|order/i, 'trade'],
  [/promotion|coupon|marketing/i, 'promotion'],
  [/merchant|store|supplier/i, 'merchant'],
  [/member|user/i, 'member'],
  [/erp|supply/i, 'supply'],
  [/controller|service\.java/i, 'backend'],
  [/\.vue$/i, 'ui'],
  [/uniapp|sheep|pages/i, 'miniapp'],
  [/sql/i, 'sql'],
  [/doc|readme/i, 'docs'],
  [/server|api/i, 'api'],
  [/web|vite/i, 'web'],
];

const SYMBOL_RE =
  /^\+(?:export\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/;

export function guessScope(relPath) {
  const p = relPath.replace(/\\/g, '/');
  for (const [re, scope] of SCOPE_RULES) {
    if (re.test(p)) return scope;
  }
  const top = p.split('/')[0];
  return top && top.length < 24 ? top.replace(/\.+/g, '') : 'work';
}

function basename(rel) {
  return path.basename(rel.replace(/\\/g, '/'));
}

async function gitNumstat(cwd, relPath) {
  try {
    let text = '';
    try {
      const { stdout } = await execFileAsync('git', ['diff', '--numstat', 'HEAD', '--', relPath], {
        cwd,
        maxBuffer: 512 * 1024,
      });
      text = stdout.trim();
    } catch {
      /* ignore */
    }
    if (!text) {
      const { stdout } = await execFileAsync('git', ['diff', '--numstat', '--cached', '--', relPath], {
        cwd,
        maxBuffer: 512 * 1024,
      });
      text = stdout.trim();
    }
    if (!text) return null;
    const line = text.split('\n')[0];
    const [ins, del] = line.split('\t');
    return {
      insertions: ins === '-' ? 0 : Number(ins) || 0,
      deletions: del === '-' ? 0 : Number(del) || 0,
    };
  } catch {
    return null;
  }
}

async function gitDiffSymbols(cwd, relPath) {
  try {
    let stdout = '';
    try {
      ({ stdout } = await execFileAsync(
        'git',
        ['diff', '--unified=0', 'HEAD', '--', relPath],
        { cwd, maxBuffer: 512 * 1024 },
      ));
    } catch {
      return [];
    }
    if (!stdout.trim()) {
      try {
        ({ stdout } = await execFileAsync(
          'git',
          ['diff', '--unified=0', '--cached', '--', relPath],
          { cwd, maxBuffer: 512 * 1024 },
        ));
      } catch {
        return [];
      }
    }
    const names = [];
    for (const line of stdout.split('\n')) {
      if (!line.startsWith('+') || line.startsWith('+++')) continue;
      const m = SYMBOL_RE.exec(line.trim());
      if (m) names.push(m[1]);
      if (names.length >= 2) break;
    }
    return names;
  } catch {
    return [];
  }
}

async function gitUntracked(cwd, relPath) {
  try {
    const { stdout } = await execFileAsync('git', ['ls-files', '--others', '--exclude-standard', '--', relPath], {
      cwd,
    });
    return Boolean(stdout.trim());
  } catch {
    return false;
  }
}

export async function summarizeFileChange(cwd, relPath, kind) {
  const scope = guessScope(relPath);
  const file = basename(relPath);

  if (kind === 'unlink') {
    return `remove(${scope}): 删除 ${file}`;
  }

  const untracked = kind === 'add' || (await gitUntracked(cwd, relPath));
  if (untracked && kind === 'add') {
    return `feat(${scope}): 新增 ${file}`;
  }

  const stats = await gitNumstat(cwd, relPath);
  const symbols = await gitDiffSymbols(cwd, relPath);

  if (untracked && !stats) {
    return `feat(${scope}): 新建未跟踪 ${file}`;
  }

  const statPart =
    stats && (stats.insertions || stats.deletions)
      ? ` +${stats.insertions}/-${stats.deletions}`
      : '';

  if (symbols.length) {
    const sym = symbols.join(', ');
    if (stats?.insertions > stats?.deletions * 2) {
      return `feat(${scope}): 扩展 ${sym}${statPart}`;
    }
    if (stats?.deletions > stats?.insertions * 2) {
      return `refactor(${scope}): 精简 ${sym}${statPart}`;
    }
    return `fix(${scope}): 调整 ${sym}${statPart}`;
  }

  if (stats) {
    if (stats.insertions && !stats.deletions) return `feat(${scope}): 更新 ${file}${statPart}`;
    if (stats.deletions && !stats.insertions) return `fix(${scope}): 移除内容 ${file}${statPart}`;
    return `chore(${scope}): 修改 ${file}${statPart}`;
  }

  if (kind === 'change') return `chore(${scope}): 保存 ${file}`;
  return `feat(${scope}): 新增 ${file}`;
}

export function summarizeWipFile(filePath, insertions, deletions, status) {
  const scope = guessScope(filePath);
  const file = basename(filePath);
  if (status === 'untracked') return `feat(${scope}): 未跟踪 ${file}`;
  const ins = insertions || 0;
  const del = deletions || 0;
  if (ins === 0 && del === 0) return `chore(${scope}): ${file}`;
  if (ins > del * 2) return `feat(${scope}): 扩展 ${file} (+${ins})`;
  if (del > ins * 2) return `fix(${scope}): 删减 ${file} (-${del})`;
  return `fix(${scope}): 修改 ${file} (+${ins}/-${del})`;
}