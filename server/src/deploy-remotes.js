import { loadRepos } from './config.js';
import { git, listGitRemotes, getPushRemoteInfo } from './deploy-git.js';

function repoCwd(repoKey) {
  const { repos } = loadRepos();
  const hit = repos[repoKey];
  if (!hit) throw new Error(`未找到仓库: ${repoKey}`);
  return hit.absPath;
}

/** 新增或修改 git remote URL（写入本机仓库） */
export async function applyGitRemote(repoKey, remoteName, url) {
  const cwd = repoCwd(repoKey);
  const name = String(remoteName ?? '').trim() || 'origin';
  const pushUrl = String(url ?? '').trim();
  if (!pushUrl) throw new Error('提交地址 URL 不能为空');

  await git(cwd, ['rev-parse', '--git-dir']);
  const remotes = await listGitRemotes(cwd);
  if (remotes.some((r) => r.name === name)) {
    await git(cwd, ['remote', 'set-url', name, pushUrl]);
  } else {
    await git(cwd, ['remote', 'add', name, pushUrl]);
  }

  const info = await getPushRemoteInfo(cwd);
  return {
    ok: true,
    repoKey,
    remoteName: name,
    url: pushUrl,
    remotes: info.remotes,
    primaryRemote: info.primaryRemote,
    primaryUrl: info.primaryUrl,
    primaryHost: info.primaryHost,
  };
}