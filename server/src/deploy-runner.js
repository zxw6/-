import { loadRepos } from './config.js';
import { readDeployConfig } from './deploy-config.js';
import { resolveDeployTarget } from './deploy-projects.js';
import { recordDeployGitSubmission } from './git-submissions.js';
import { createDeployDraft } from './deploy-drafts.js';
import {
  git,
  readLastCommit,
  gitCurrentBranch,
  resolveGitRemote,
  getPushRemoteInfo,
  hostDisplayName,
  syncRemoteBeforeLocalCommit,
} from './deploy-git.js';
import { isWebhookConfigured } from './deploy-projects.js';

function findRepo(repoKey) {
  const { repos } = loadRepos();
  const hit = repos[repoKey];
  if (!hit) throw new Error(`未找到监听仓库 key: ${repoKey}`);
  return hit;
}

export async function getRemotesForRepo(repoKey) {
  const repo = findRepo(repoKey);
  const info = await getPushRemoteInfo(repo.absPath);
  return {
    ok: true,
    repoKey,
    remotes: info.remotes,
    primaryRemote: info.primaryRemote,
    primaryUrl: info.primaryUrl,
    primaryHost: info.primaryHost,
    primaryHostLabel: hostDisplayName(info.primaryHost) || info.primaryHost,
  };
}

export async function runDeployTarget(db, targetId, options = {}) {
  const cfg = readDeployConfig();
  const target = resolveDeployTarget(targetId, options.repoKey);

  const repo = findRepo(target.repoKey);
  const cwd = repo.absPath;
  const logs = [];
  const push = options.push !== false && target.pushBeforeWebhook !== false;
  const branch = options.branch || target.branch || 'master';
  const prefix = cfg.defaults.commitMessagePrefix ?? '';
  const userMsg = String(options.commitMessage ?? '').trim();
  const commitMessage = userMsg ? `${prefix}${userMsg}` : `${prefix}auto ${new Date().toISOString()}`;

  logs.push(`仓库: ${repo.label} (${target.repoKey})`);
  logs.push(`路径: ${cwd}`);

  const draft = await createDeployDraft(db, {
    repoKey: target.repoKey,
    targetId: target.id,
    note: userMsg || `目标 ${target.label}`,
  });
  logs.push(
    `草稿箱 #${draft.id}：已备份 ${draft.shortHash}${draft.hasWip ? '（含未提交改动）' : ''}`,
  );

  const allowCommit = options.allowCommit !== false;

  let pushRemoteName = 'origin';
  let pushBranchEarly = branch;
  if (push) {
    const pushInfoEarly = await getPushRemoteInfo(cwd);
    const configuredPushEarly = String(target.pushRemote || target.gitRemote || '').trim();
    pushRemoteName = resolveGitRemote(pushInfoEarly.remotes, {
      gitRemote: options.gitRemote || configuredPushEarly || '',
      gitHost: options.gitHost || '',
      preferRemote: pushInfoEarly.primaryRemote,
    });
    try {
      await git(cwd, ['rev-parse', '--verify', `refs/heads/${branch}`]);
      pushBranchEarly = branch;
    } catch {
      pushBranchEarly = await gitCurrentBranch(cwd);
    }
    await syncRemoteBeforeLocalCommit(cwd, pushRemoteName, pushBranchEarly, logs);
  }

  const status = await git(cwd, ['status', '--porcelain']);
  if (status) {
    if (!allowCommit) {
      throw new Error('工作区有未提交改动：请填写提交说明并确认「提交后部署」，或先本地提交');
    }
    logs.push('检测到未提交改动，执行 add + commit…');
    await git(cwd, ['add', '-A']);
    await git(cwd, ['commit', '-m', commitMessage]);
    logs.push(`已提交: ${commitMessage}`);
  } else {
    logs.push('工作区干净，跳过 commit');
  }

  const curBranch = await gitCurrentBranch(cwd);
  let pushBranch = branch;
  try {
    await git(cwd, ['rev-parse', '--verify', `refs/heads/${branch}`]);
  } catch {
    pushBranch = curBranch;
    logs.push(`配置分支「${branch}」在本地不存在，将推送当前分支「${pushBranch}」`);
  }
  if (curBranch !== pushBranch) {
    logs.push(`当前检出分支 ${curBranch}，推送分支 ${pushBranch}`);
  }

  let commitInfo = await readLastCommit(cwd);

  if (push) {
    const pushInfo = await getPushRemoteInfo(cwd);
    const remotes = pushInfo.remotes;
    const configuredPush = String(target.pushRemote || target.gitRemote || '').trim();
    const remoteName = resolveGitRemote(remotes, {
      gitRemote: options.gitRemote || configuredPush || '',
      gitHost: options.gitHost || '',
      preferRemote: pushInfo.primaryRemote,
    });
    const remoteMeta = remotes.find((r) => r.name === remoteName);
    const hostLabel = hostDisplayName(remoteMeta?.host) || remoteName;
    const pushUrl = remoteMeta?.url || pushInfo.primaryUrl;
    logs.push(`提交网站: ${hostLabel || 'Git'}${pushUrl ? ` · ${pushUrl}` : ''}`);
    if (remoteName === pushInfo.primaryRemote) {
      logs.push(`按项目原有推送地址（remote: ${remoteName}）`);
    } else {
      logs.push(`推送到 remote: ${remoteName}`);
    }
    try {
      await git(cwd, ['fetch', remoteName, pushBranch]);
      const behind = await git(cwd, ['rev-list', '--count', `HEAD..${remoteName}/${pushBranch}`]).catch(() => '0');
      if (behind !== '0') {
        await git(cwd, ['rebase', `${remoteName}/${pushBranch}`]);
        logs.push('推送前已与远程对齐');
      }
    } catch (e) {
      const msg = String(e?.message || e);
      if (/no such remote|couldn't find remote ref|not a git repository/i.test(msg)) {
        logs.push('远程分支尚不存在，直接 push');
      } else {
        throw new Error(`推送前同步失败（请在本地解决冲突后重试）: ${msg}`);
      }
    }
    logs.push(`git push ${remoteName} ${pushBranch}…`);
    await git(cwd, ['push', '-u', remoteName, pushBranch]);
    logs.push('push 完成');
    commitInfo = await readLastCommit(cwd);
  } else {
    logs.push('已跳过 push');
  }

  if (isWebhookConfigured(target)) {
    logs.push(`服务器拉取/替换/发布（宝塔 Webhook）…`);
    const headers = { 'Content-Type': 'application/json' };
    if (target.webhookSecret) {
      headers['X-Deploy-Token'] = String(target.webhookSecret);
    }
    const body = JSON.stringify({
      target: target.id,
      branch,
      commit: commitInfo.shortHash,
      message: commitInfo.message,
      repoKey: target.repoKey,
    });
    const res = await fetch(target.webhookUrl, { method: 'POST', headers, body });
    const text = await res.text().catch(() => '');
    if (!res.ok) throw new Error(`Webhook 失败 HTTP ${res.status}: ${text.slice(0, 200)}`);
    logs.push(`服务器响应: ${text.slice(0, 300) || res.status}`);
  } else {
    logs.push('未配置宝塔发布：仅完成代码仓库推送');
  }

  const record = recordDeployGitSubmission(db, {
    repoKey: target.repoKey,
    repoLabel: repo.label,
    authorName: commitInfo.authorName,
    authorEmail: commitInfo.authorEmail,
    gitAccount: commitInfo.authorEmail || commitInfo.authorName,
    message: `部署 ${target.label}: ${commitInfo.message}`,
    action: 'deploy',
    branch,
    commitHash: commitInfo.commitHash,
    shortHash: commitInfo.shortHash,
    committedAt: Date.now(),
  });

  return {
    ok: true,
    logs,
    submission: record,
    targetId: target.id,
    draftId: draft.id,
  };
}