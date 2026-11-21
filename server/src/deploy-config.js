import fs from 'node:fs';
import path from 'node:path';
import { USER_HOME, loadRepos } from './config.js';

export const DEPLOY_CONFIG_PATH = path.join(USER_HOME, 'deploy.json');
const EXAMPLE = path.join(USER_HOME, 'deploy.config.example.json');

const DEFAULTS = {
  defaults: { commitMessagePrefix: 'chore: deploy ' },
  targets: [],
};

export function ensureDeployConfig() {
  if (!fs.existsSync(DEPLOY_CONFIG_PATH) && fs.existsSync(EXAMPLE)) {
    fs.copyFileSync(EXAMPLE, DEPLOY_CONFIG_PATH);
    console.log(`[code-workbench] 已生成部署配置：${DEPLOY_CONFIG_PATH}`);
  }
}

export function readDeployConfig() {
  ensureDeployConfig();
  if (!fs.existsSync(DEPLOY_CONFIG_PATH)) {
    return { ...DEFAULTS, configPath: DEPLOY_CONFIG_PATH };
  }
  const raw = JSON.parse(fs.readFileSync(DEPLOY_CONFIG_PATH, 'utf8'));
  return {
    defaults: { ...DEFAULTS.defaults, ...(raw.defaults ?? {}) },
    targets: Array.isArray(raw.targets) ? raw.targets : [],
    configPath: DEPLOY_CONFIG_PATH,
  };
}

export function saveDeployConfig(patch) {
  ensureDeployConfig();
  const prev = readDeployConfig();
  const next = {
    defaults: patch.defaults ? { ...prev.defaults, ...patch.defaults } : prev.defaults,
    targets: Array.isArray(patch.targets) ? patch.targets : prev.targets,
  };
  fs.writeFileSync(DEPLOY_CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
  return { ...next, configPath: DEPLOY_CONFIG_PATH };
}

export function upsertDeployTargetForRepo(repoKey, patch) {
  ensureDeployConfig();
  const prev = readDeployConfig();
  const key = String(repoKey ?? '').trim();
  if (!key) throw new Error('repoKey required');
  const repo = loadRepos().repos[key];
  if (!repo) throw new Error(`监听仓库不存在: ${key}`);

  const targets = [...(prev.targets ?? [])];
  const idx = targets.findIndex((t) => t.repoKey === key);
  const prevRow = idx >= 0 ? targets[idx] : {};
  const id = patch.id || prevRow.id || `${key}-deploy`;
  const row = {
    id,
    label: patch.label ?? prevRow.label ?? repo.label,
    repoKey: key,
    branch: patch.branch ?? prevRow.branch ?? 'master',
    gitRemote: patch.pushRemote ?? patch.gitRemote ?? prevRow.gitRemote ?? prevRow.pushRemote ?? '',
    pushRemote: patch.pushRemote ?? patch.gitRemote ?? prevRow.pushRemote ?? prevRow.gitRemote ?? '',
    submitLabel: patch.submitLabel ?? prevRow.submitLabel ?? '',
    pushRemoteUrl: patch.pushRemoteUrl ?? prevRow.pushRemoteUrl ?? '',
    gitHost: patch.gitHost ?? prevRow.gitHost ?? '',
    pushBeforeWebhook: patch.pushBeforeWebhook ?? prevRow.pushBeforeWebhook ?? true,
    webhookUrl: patch.webhookUrl ?? prevRow.webhookUrl ?? '',
    webhookSecret: patch.webhookSecret ?? prevRow.webhookSecret ?? '',
    baotaSitePath: patch.baotaSitePath ?? prevRow.baotaSitePath ?? '',
    note: patch.note ?? prevRow.note ?? '',
  };

  if (idx >= 0) targets[idx] = row;
  else targets.push(row);

  return saveDeployConfig({ targets });
}