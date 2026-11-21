import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function git(cwd, args, opts = {}) {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      maxBuffer: opts.maxBuffer ?? 16 * 1024 * 1024,
    });
    return (stdout ?? stderr ?? '').trim();
  } catch (e) {
    const msg = e.stderr || e.stdout || e.message;
    throw new Error(String(msg).trim() || 'git 命令失败');
  }
}

export async function readLastCommit(cwd) {
  const out = await git(cwd, ['log', '-1', '--pretty=format:%H|%h|%an|%ae|%s']);
  const [hash, short, authorName, authorEmail, ...msg] = out.split('|');
  return {
    commitHash: hash,
    shortHash: short,
    authorName,
    authorEmail,
    message: msg.join('|'),
  };
}

export async function gitCurrentBranch(cwd) {
  return git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
}

export async function listGitRemotes(cwd) {
  const out = await git(cwd, ['remote', '-v']);
  const map = new Map();
  for (const line of out.split('\n')) {
    const m = /^(\S+)\s+(\S+)\s+\((fetch|push)\)/.exec(line.trim());
    if (!m) continue;
    const [, name, url, kind] = m;
    const hit = map.get(name) ?? { name, urlFetch: '', urlPush: '' };
    if (kind === 'fetch') hit.urlFetch = url;
    else hit.urlPush = url;
    map.set(name, hit);
  }
  return [...map.values()].map((r) => {
    const url = r.urlPush || r.urlFetch;
    let host = 'other';
    if (/github\.com/i.test(url)) host = 'github';
    else if (/gitee\.com/i.test(url)) host = 'gitee';
    else if (/gitlab\.com/i.test(url)) host = 'gitlab';
    else if (/gitee\.io/i.test(url)) host = 'gitee';
    else if (/coding\.net|codeup\.aliyun/i.test(url)) host = 'coding';
    else if (/lanhuapp|lanhu/i.test(url)) host = 'lanhu';
    else if (/bitbucket/i.test(url)) host = 'bitbucket';
    return { name: r.name, url, host };
  });
}

/** 从 remote URL 猜提交站点展示名 */
export function guessSubmitSiteName(url) {
  const s = String(url ?? '');
  if (!s) return '';
  if (/gitee\.com/i.test(s)) return 'Gitee';
  if (/github\.com/i.test(s)) return 'GitHub';
  if (/gitlab/i.test(s)) return 'GitLab';
  if (/lanhu/i.test(s)) return '蓝湖';
  if (/coding\.net|codeup/i.test(s)) return 'Coding';
  if (/bitbucket/i.test(s)) return 'Bitbucket';
  try {
    const norm = s.replace(/^git@([^:]+):(.+)$/, 'https://$1/$2');
    const u = new URL(norm.includes('://') ? norm : `https://${norm}`);
    const host = u.hostname.replace(/^www\./, '');
    const part = host.split('.')[0];
    if (part && part.length > 1) return part.charAt(0).toUpperCase() + part.slice(1);
  } catch {
    /* ignore */
  }
  return 'Git';
}

export function resolveGitRemote(remotes, { gitRemote, gitHost, preferRemote } = {}) {
  const list = remotes ?? [];
  const byName = String(gitRemote ?? '').trim();
  if (byName && list.some((r) => r.name === byName)) return byName;

  const host = String(gitHost ?? '').trim().toLowerCase();
  if (host === 'github') {
    const hit = list.find((r) => r.host === 'github');
    if (hit) return hit.name;
  }
  if (host === 'gitee') {
    const hit = list.find((r) => r.host === 'gitee');
    if (hit) return hit.name;
  }

  const prefer = String(preferRemote ?? '').trim();
  if (prefer && list.some((r) => r.name === prefer)) return prefer;

  const origin = list.find((r) => r.name === 'origin');
  if (origin) return origin.name;
  return list[0]?.name ?? 'origin';
}

/** 优先使用当前分支 tracking 的上游 remote */
export async function getPushRemoteInfo(cwd) {
  const remotes = await listGitRemotes(cwd);
  let remoteName = '';
  try {
    const up = await git(cwd, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
    remoteName = up.split('/')[0];
  } catch {
    remoteName = '';
  }
  if (!remotes.some((r) => r.name === remoteName)) {
    remoteName = remotes.find((r) => r.name === 'origin')?.name ?? remotes[0]?.name ?? 'origin';
  }
  const meta = remotes.find((r) => r.name === remoteName);
  return {
    remotes,
    primaryRemote: remoteName,
    primaryUrl: meta?.url ?? '',
    primaryHost: meta?.host ?? 'other',
  };
}

export function hostDisplayName(host) {
  if (host === 'github') return 'GitHub';
  if (host === 'gitee') return 'Gitee';
  if (host === 'gitlab') return 'GitLab';
  if (host === 'coding') return 'Coding';
  if (host === 'lanhu') return '蓝湖';
  if (host === 'bitbucket') return 'Bitbucket';
  return '';
}

const STASH_MSG = 'code-workbench: pre-sync';

/** 提交前先与远程对齐，降低「先 commit 再 rebase」触发的 README 冲突 */
export async function syncRemoteBeforeLocalCommit(cwd, remoteName, branch, logs) {
  try {
    await git(cwd, ['fetch', remoteName, branch]);
  } catch (e) {
    logs.push(`fetch 跳过: ${String(e.message || e).slice(0, 120)}`);
    return;
  }

  let behind = '0';
  try {
    behind = await git(cwd, ['rev-list', '--count', `HEAD..${remoteName}/${branch}`]);
  } catch {
    logs.push('远程尚无对应分支，跳过同步');
    return;
  }
  if (!behind || behind === '0') {
    logs.push('远程无新提交');
    return;
  }

  logs.push(`远程领先 ${behind} 个提交，提交前先同步…`);
  const porcelain = await git(cwd, ['status', '--porcelain']);
  const hadLocal = Boolean(porcelain.trim());

  if (hadLocal) {
    await git(cwd, ['stash', 'push', '-u', '-m', STASH_MSG]);
    try {
      await git(cwd, ['rebase', `${remoteName}/${branch}`]);
      logs.push('已 rebase 到远程');
    } catch (e) {
      try {
        await git(cwd, ['rebase', '--abort']);
      } catch {
        /* ignore */
      }
      try {
        await git(cwd, ['stash', 'pop']);
      } catch {
        /* ignore */
      }
      throw e;
    }
    try {
      await git(cwd, ['stash', 'pop']);
      logs.push('已恢复本地未提交改动');
    } catch (e) {
      await resolveStashPopConflicts(cwd, logs);
    }
  } else {
    await git(cwd, ['rebase', `${remoteName}/${branch}`]);
    logs.push('已与远程对齐');
  }
}

async function resolveStashPopConflicts(cwd, logs) {
  let unmerged = '';
  try {
    unmerged = await git(cwd, ['diff', '--name-only', '--diff-filter=U']);
  } catch {
    /* ignore */
  }
  const files = unmerged
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!files.length) {
    throw new Error('恢复本地改动失败，请在本机执行 git status 处理');
  }
  for (const f of files) {
    if (f === 'README.md') {
      await git(cwd, ['checkout', 'stash@{0}', '--', 'README.md']);
      await git(cwd, ['add', 'README.md']);
      logs.push('README.md 冲突已采用本地未提交版本');
    }
  }
  const still = await git(cwd, ['diff', '--name-only', '--diff-filter=U']).catch(() => '');
  if (still.trim()) {
    throw new Error(`仍有未解决冲突: ${still.trim()}，请在本地解决后重试部署`);
  }
  try {
    await git(cwd, ['stash', 'drop']);
  } catch {
    /* ignore */
  }
}