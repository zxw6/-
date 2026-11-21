import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.js';
import { readMonitorConfig } from './config.js';
import { readDeployConfig } from './deploy-config.js';
import { loadProfile, avatarAbsPath } from './profile.js';
import { git } from './deploy-git.js';
import { yearStatsSummary } from './db.js';

function parseGithubOwner(url) {
  const s = String(url ?? '').trim();
  if (!s) return '';
  const norm = s.replace(/^git@github\.com:/i, 'https://github.com/');
  const m = norm.match(/github\.com[/:]([^/]+)/i);
  return m?.[1] ?? '';
}

/** 从 deploy 配置里取 GitHub 用户名 */
export function resolveGithubUsername() {
  const profile = loadProfile();
  const fromProfile = String(profile.githubUsername ?? '').trim();
  if (fromProfile) return fromProfile;

  const cfg = readDeployConfig();
  for (const t of cfg.targets ?? []) {
    const url = t.pushRemoteUrl || t.gitRemoteUrl || '';
    const owner = parseGithubOwner(url);
    if (owner) return owner;
  }

  return '';
}

function findWorkbenchRepoUrl(githubUser) {
  const cfg = readDeployConfig();
  for (const t of cfg.targets ?? []) {
    const url = String(t.pushRemoteUrl || '').trim();
    if (/github\.com/i.test(url)) return url.replace(/\.git$/i, '');
  }
  if (githubUser) return `https://github.com/${githubUser}/-`;
  return '';
}

export function buildGithubProfileReadme({ profile, repositories, repoCount, activityTotal, githubUser, workbenchRepoUrl }) {
  const display = profile.nickname || profile.username || 'developer';
  const bio = String(profile.bio ?? '').trim() || '—';
  const city = String(profile.city ?? '').trim() || '—';
  const year = new Date().getFullYear();
  const user = githubUser || 'your-github-username';

  const rows = (repositories ?? [])
    .map((r) => `| ${String(r.label || r.key).trim()} | ${String(r.note || r.key).trim() || '—'} |`)
    .join('\n');

  const avatarBlock = `<p align="center">\n  <img src="./avatar.png" alt="avatar" width="120" style="border-radius:50%"/>\n</p>\n\n`;

  return `${avatarBlock}# Hi，我是 ${display} 👋

**${bio}**

${city} · 监听 **${repoCount}** 个仓库 · 过去一年内 **${activityTotal}** 次活动记录

---

## 代码工作台

自研本地工作台：活动热力图、提交记录、一键部署。

${workbenchRepoUrl ? `主仓库：[${workbenchRepoUrl.replace('https://github.com/', '')}](${workbenchRepoUrl})` : ''}

## 正在关注的仓库

| 仓库 | 说明 |
|------|------|
${rows || '| — | — |'}

---

<p align="center">
  <img height="160em" src="https://github-readme-stats.vercel.app/api?username=${user}&show_icons=true&theme=transparent&include_all_commits=true&count_private=true" alt="stats" />
  <img height="160em" src="https://github-readme-stats.vercel.app/api/top-langs/?username=${user}&layout=compact&theme=transparent" alt="langs" />
</p>

<sub>由代码工作台同步 · ${year}</sub>
`;
}

export async function syncGithubProfile(db) {
  const githubUser = resolveGithubUsername();
  if (!githubUser) {
    throw new Error('未找到 GitHub 用户名：请在 deploy.json 填写 GitHub 推送地址，或在 profile.json 增加 githubUsername');
  }

  const profile = loadProfile();
  const monitor = readMonitorConfig();
  const repos = monitor.repositories ?? [];
  const year = new Date().getFullYear();
  const stats = yearStatsSummary(db, year);
  const workbenchRepoUrl = findWorkbenchRepoUrl(githubUser);

  const readme = buildGithubProfileReadme({
    profile,
    repositories: repos,
    repoCount: repos.length,
    activityTotal: stats.totalContributions ?? 0,
    githubUser,
    workbenchRepoUrl,
  });

  const repoDir = path.join(DATA_DIR, 'github-profile', githubUser);
  fs.mkdirSync(repoDir, { recursive: true });

  const remoteUrl = `https://github.com/${githubUser}/${githubUser}.git`;
  const hasGit = fs.existsSync(path.join(repoDir, '.git'));

  if (!hasGit) {
    const parent = path.dirname(repoDir);
    const tmpDir = `${repoDir}.clone-tmp`;
    try {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
      await git(parent, ['clone', '--depth', '1', remoteUrl, tmpDir]);
      if (fs.existsSync(repoDir)) fs.rmSync(repoDir, { recursive: true, force: true });
      fs.renameSync(tmpDir, repoDir);
    } catch {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
      fs.mkdirSync(repoDir, { recursive: true });
      await git(repoDir, ['init']);
      try {
        await git(repoDir, ['remote', 'add', 'origin', remoteUrl]);
      } catch {
        /* 可能已存在 */
      }
      await git(repoDir, ['checkout', '-B', 'main']);
    }
  } else {
    try {
      await git(repoDir, ['pull', '--rebase', 'origin', 'main']);
    } catch {
      /* 远程仓库可能尚未创建 */
    }
  }

  fs.writeFileSync(path.join(repoDir, 'README.md'), readme, 'utf8');

  const avatarSrc = avatarAbsPath(profile.avatarFile);
  if (avatarSrc) {
    fs.copyFileSync(avatarSrc, path.join(repoDir, 'avatar.png'));
  }

  const status = await git(repoDir, ['status', '--porcelain']);
  if (!status.trim()) {
    return { ok: true, pushed: false, githubUser, profileUrl: `https://github.com/${githubUser}`, message: '内容已是最新' };
  }

  await git(repoDir, ['add', 'README.md']);
  if (avatarSrc) await git(repoDir, ['add', 'avatar.png']);
  await git(repoDir, ['commit', '-m', 'chore: 从代码工作台同步简介']);
  try {
    await git(repoDir, ['push', '-u', 'origin', 'main']);
  } catch (e) {
    const msg = String(e.message || e);
    if (/repository not found/i.test(msg)) {
      throw new Error(
        `GitHub 上还没有仓库 ${githubUser}/${githubUser}，请先在网页新建同名公开仓库后再点同步`,
      );
    }
    throw e;
  }

  return {
    ok: true,
    pushed: true,
    githubUser,
    profileUrl: `https://github.com/${githubUser}`,
  };
}