import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { loadRepos } from './config.js';
import {
  listGitSubmissions,
  recordGitSubmission,
  gitSubmissionExists,
} from './db.js';

const execFileAsync = promisify(execFile);

function parseMerge(message) {
  const isMerge = /^merge\b/i.test(message.trim());
  if (!isMerge) {
    return { action: 'commit', mergeFrom: '', mergeInto: '' };
  }
  let mergeInto = '';
  let mergeFrom = '';
  const intoBranch = message.match(/into\s+(\S+)/i);
  const fromBranch = message.match(/from\s+(\S+)/i);
  if (intoBranch) mergeInto = intoBranch[1];
  if (fromBranch) mergeFrom = fromBranch[1];
  const branchQuoted = message.match(/branch\s+'([^']+)'/i);
  if (branchQuoted && !mergeFrom) mergeFrom = branchQuoted[1];
  return { action: 'merge', mergeFrom, mergeInto };
}

async function gitCurrentBranch(cwd) {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
    return stdout.trim();
  } catch {
    return '';
  }
}

export async function readGitLogFromRepo(repoPath, limit = 40) {
  const cwd = repoPath;
  if (!existsSync(cwd)) return [];
  try {
    await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd });
  } catch {
    return [];
  }
  const branch = await gitCurrentBranch(cwd);
  const { stdout } = await execFileAsync(
    'git',
    ['log', `-${limit}`, '--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%ai%x1f%s'],
    { cwd, maxBuffer: 8 * 1024 * 1024 },
  );
  const lines = stdout.split('\n').filter(Boolean);
  return lines.map((line) => {
    const [hash, shortHash, authorName, authorEmail, committedAt, ...msgParts] = line.split('\x1f');
    const message = msgParts.join('\x1f');
    const { action, mergeFrom, mergeInto } = parseMerge(message);
    return {
      commitHash: hash,
      shortHash,
      authorName,
      authorEmail,
      committedAt,
      message,
      action,
      branch,
      mergeFrom,
      mergeInto,
    };
  });
}

export async function syncGitSubmissionsFromRepos(db, limitPerRepo = 30) {
  const { repos } = loadRepos();
  let inserted = 0;
  for (const repo of Object.values(repos)) {
    const rows = await readGitLogFromRepo(repo.absPath, limitPerRepo);
    for (const row of rows) {
      if (gitSubmissionExists(db, repo.key, row.commitHash)) continue;
      recordGitSubmission(db, {
        repoKey: repo.key,
        repoLabel: repo.label || repo.key,
        authorName: row.authorName,
        authorEmail: row.authorEmail,
        gitAccount: row.authorEmail || row.authorName,
        message: row.message,
        action: row.action,
        branch: row.branch,
        mergeFrom: row.mergeFrom,
        mergeInto: row.mergeInto,
        commitHash: row.commitHash,
        shortHash: row.shortHash,
        committedAt: Date.parse(row.committedAt) || Date.now(),
        source: 'sync',
      });
      inserted += 1;
    }
  }
  return { inserted };
}

/** 自动部署 / 脚本在 git 完成后调用 */
export function recordDeployGitSubmission(db, payload) {
  const row = recordGitSubmission(db, {
    repoKey: payload.repoKey ?? '',
    repoLabel: payload.repoLabel ?? payload.repoKey ?? '',
    authorName: payload.authorName ?? payload.gitUser ?? '',
    authorEmail: payload.authorEmail ?? '',
    gitAccount: payload.gitAccount ?? payload.authorEmail ?? payload.authorName ?? '',
    message: payload.message ?? '',
    action: payload.action ?? 'deploy',
    branch: payload.branch ?? '',
    mergeFrom: payload.mergeFrom ?? '',
    mergeInto: payload.mergeInto ?? '',
    commitHash: payload.commitHash ?? '',
    shortHash: payload.shortHash ?? '',
    committedAt: payload.committedAt ?? Date.now(),
    source: payload.source ?? 'deploy',
  });
  return row;
}

export function getGitSubmissions(db, opts = {}) {
  return listGitSubmissions(db, opts);
}