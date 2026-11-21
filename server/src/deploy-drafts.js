import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';
import { loadRepos } from './config.js';
import { git, gitCurrentBranch } from './deploy-git.js';
import {
  insertDeployDraft,
  listDeployDrafts,
  getDeployDraft,
  deleteDeployDraft,
  trimDeployDrafts,
} from './db.js';

const DRAFTS_ROOT = path.join(DATA_DIR, 'deploy-drafts');
const MAX_DRAFTS_PER_REPO = 30;

function repoAbs(repoKey) {
  const { repos } = loadRepos();
  const hit = repos[repoKey];
  if (!hit) throw new Error(`未找到仓库: ${repoKey}`);
  return hit;
}

function ensureDraftDir(id) {
  const dir = path.join(DRAFTS_ROOT, String(id));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** 部署前快照：保留 HEAD + 未提交改动（stash create 不动工作区） */
export async function createDeployDraft(db, { repoKey, targetId, note = '' }) {
  const repo = repoAbs(repoKey);
  const cwd = repo.absPath;
  await git(cwd, ['rev-parse', '--git-dir']);

  const headHash = await git(cwd, ['rev-parse', 'HEAD']);
  const shortHash = await git(cwd, ['rev-parse', '--short', 'HEAD']);
  const branch = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const dirty = await git(cwd, ['status', '--porcelain']);

  let wipCommit = '';
  const draftRow = insertDeployDraft(db, {
    repoKey,
    targetId: targetId ?? '',
    repoLabel: repo.label,
    headHash,
    shortHash,
    branch,
    wipCommit: '',
    note: String(note ?? '').trim() || `部署前备份 ${shortHash}`,
    createdAt: Date.now(),
  });

  const dir = ensureDraftDir(draftRow.id);
  fs.writeFileSync(path.join(dir, 'HEAD.txt'), headHash, 'utf8');
  fs.writeFileSync(path.join(dir, 'branch.txt'), branch, 'utf8');

  if (dirty) {
    wipCommit = await git(cwd, ['stash', 'create', '-u', `workbench-draft-${draftRow.id}`]);
    if (wipCommit) {
      const patch = await git(cwd, ['show', '--pretty=format:', '-p', wipCommit]);
      fs.writeFileSync(path.join(dir, 'wip.patch'), patch, 'utf8');
      fs.writeFileSync(path.join(dir, 'wip-commit.txt'), wipCommit, 'utf8');
    }
  }

  const updated = insertDeployDraft(db, {
    ...draftRow,
    wipCommit,
    id: draftRow.id,
  });

  trimDeployDrafts(db, repoKey, MAX_DRAFTS_PER_REPO);
  return updated;
}

export function getDeployDrafts(db, repoKey) {
  return listDeployDrafts(db, repoKey);
}

/** 用草稿覆盖当前工作区（回滚到部署前） */
export async function restoreDeployDraft(db, draftId) {
  const row = getDeployDraft(db, draftId);
  if (!row) throw new Error('草稿不存在');

  const repo = repoAbs(row.repoKey);
  const cwd = repo.absPath;
  const dir = path.join(DRAFTS_ROOT, String(draftId));

  const headHash = row.headHash || fs.readFileSync(path.join(dir, 'HEAD.txt'), 'utf8').trim();
  const logs = [];
  logs.push(`回滚仓库 ${repo.label} → ${headHash.slice(0, 7)}`);

  await git(cwd, ['reset', '--hard', headHash]);
  logs.push('已重置到备份时的提交');

  const wipCommit = row.wipCommit || (fs.existsSync(path.join(dir, 'wip-commit.txt'))
    ? fs.readFileSync(path.join(dir, 'wip-commit.txt'), 'utf8').trim()
    : '');

  if (wipCommit) {
    try {
      await git(cwd, ['cherry-pick', '--no-commit', wipCommit]);
      logs.push('已恢复未提交的本地改动');
    } catch {
      const patchFile = path.join(dir, 'wip.patch');
      if (fs.existsSync(patchFile)) {
        const patch = fs.readFileSync(patchFile, 'utf8');
        fs.writeFileSync(path.join(dir, '_apply.patch'), patch);
        try {
          await git(cwd, ['apply', '--whitespace=nowarn', patchFile]);
          logs.push('已通过补丁恢复未提交改动');
        } catch (e2) {
          throw new Error(`恢复工作区失败：${e2.message}`);
        }
      }
    }
  } else {
    logs.push('备份时无未提交改动');
  }

  return { ok: true, logs, draft: row };
}

export function removeDeployDraft(db, draftId) {
  const row = getDeployDraft(db, draftId);
  if (!row) throw new Error('草稿不存在');
  const dir = path.join(DRAFTS_ROOT, String(draftId));
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  deleteDeployDraft(db, draftId);
  return { ok: true, id: draftId };
}