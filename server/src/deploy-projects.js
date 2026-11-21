import { loadRepos } from './config.js';
import { readDeployConfig } from './deploy-config.js';

const PLACEHOLDER =
  /你的域名|换成长随机字符串|\/www\/wwwroot\/xhd-admin|^my-app$|示例|example/i;

/** 根据 deploy.json 条目解析展示标签：自定义名 / GitHub / Gitee / 宝塔 … */
export function configTagsForTarget(t) {
  if (!t) return [];
  const tags = [];
  const submitLabel = String(t.submitLabel || '').trim();
  if (submitLabel) tags.push(submitLabel);

  const host = String(t.gitHost || '').toLowerCase();
  if (host === 'github' && !tags.includes('GitHub')) tags.push('GitHub');
  if (host === 'gitee' && !tags.includes('Gitee')) tags.push('Gitee');
  const mode = String(t.deployMode || '').toLowerCase();
  if (mode === 'github' && !tags.includes('GitHub')) tags.push('GitHub');
  if (mode === 'gitee' && !tags.includes('Gitee')) tags.push('Gitee');
  if (mode === 'baota' && !tags.includes('宝塔')) tags.push('宝塔');

  const wh = String(t.webhookUrl || '').trim();
  if (wh && !PLACEHOLDER.test(wh) && !tags.includes('宝塔')) tags.push('宝塔');

  const site = String(t.baotaSitePath || '').trim();
  if (site && !PLACEHOLDER.test(site) && !tags.includes('宝塔')) tags.push('宝塔');

  return tags;
}

export function configLabelFromTags(tags, t) {
  if (tags?.length) return tags.join('·');
  if (t) {
    const sub = String(t.submitLabel || '').trim();
    if (sub) return sub;
    if (isWebhookConfigured(t)) return '宝塔';
    const pr = String(t.pushRemote || t.gitRemote || '').trim();
    if (pr) return pr;
  }
  return '没有配置';
}

export function isWebhookConfigured(target) {
  const wh = String(target?.webhookUrl ?? '').trim();
  return Boolean(wh && !PLACEHOLDER.test(wh));
}

/** 可选项目 = config.json 监听仓库，叠加上 deploy.json 的部署配置 */
export function listDeployProjects() {
  const cfg = readDeployConfig();
  const { repos } = loadRepos();
  const byKey = new Map(cfg.targets.map((t) => [t.repoKey, t]));
  const projects = [];

  for (const r of Object.values(repos)) {
    const t = byKey.get(r.key);
    const configTags = configTagsForTarget(t);
    projects.push({
      id: t?.id ?? `repo:${r.key}`,
      repoKey: r.key,
      label: t?.label ?? r.label,
      hasDeployRow: Boolean(t),
      configTags,
      configLabel: configLabelFromTags(configTags, t),
      branch: t?.branch ?? 'master',
      gitRemote: t?.pushRemote ?? t?.gitRemote ?? '',
      pushRemote: t?.pushRemote ?? t?.gitRemote ?? '',
      pushRemoteUrl: t?.pushRemoteUrl ?? '',
      submitLabel: t?.submitLabel ?? '',
      gitHost: t?.gitHost ?? '',
      baotaSitePath: t?.baotaSitePath ?? '',
      webhookUrl: t?.webhookUrl ?? '',
      webhookSecret: t?.webhookSecret ?? '',
      pushBeforeWebhook: t?.pushBeforeWebhook !== false,
      note: t?.note ?? r.purpose ?? '',
      localPath: r.absPath,
    });
  }

  projects.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));
  return projects;
}

export function resolveDeployTarget(targetId, repoKey = '') {
  const cfg = readDeployConfig();
  const { repos } = loadRepos();

  const keyFromVirtual = targetId?.startsWith('repo:') ? targetId.slice(5) : '';
  const repoKeyResolved = String(repoKey || keyFromVirtual || '').trim();

  if (repoKeyResolved) {
    const fromCfg = cfg.targets.find((t) => t.repoKey === repoKeyResolved);
    if (fromCfg) return fromCfg;
    const r = repos[repoKeyResolved];
    if (!r) throw new Error(`未找到监听仓库 key: ${repoKeyResolved}`);
    return {
      id: `repo:${repoKeyResolved}`,
      label: r.label,
      repoKey: repoKeyResolved,
      branch: 'master',
      gitRemote: 'origin',
      pushBeforeWebhook: true,
      webhookUrl: '',
    };
  }

  const hit = cfg.targets.find((t) => t.id === targetId);
  if (hit) return hit;
  throw new Error(`未知部署目标: ${targetId}，请从左侧选择监听中的项目`);
}