import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** 程序根目录 E:\22job，整夹可复制到新电脑 */
export const PACKAGE_ROOT = path.resolve(__dirname, '../..');

/** 数据与配置默认都在 E:\22job 下，不占用公司项目目录 */
export const USER_HOME = process.env.CODE_WORKBENCH_HOME
  ? path.resolve(process.env.CODE_WORKBENCH_HOME)
  : PACKAGE_ROOT;

export const DATA_DIR = path.join(USER_HOME, 'data');
export const DB_PATH = path.join(DATA_DIR, 'activity.db');
export const CONFIG_PATH = path.join(USER_HOME, 'config.json');
export const EXAMPLE_CONFIG = path.join(PACKAGE_ROOT, 'config.example.json');

function expandHome(p) {
  if (!p) return p;
  if (p.startsWith('~/') || p === '~') {
    return path.join(os.homedir(), p.slice(2));
  }
  return path.resolve(p);
}

export function ensureUserConfig() {
  if (fs.existsSync(CONFIG_PATH)) return;
  fs.mkdirSync(USER_HOME, { recursive: true });
  if (fs.existsSync(EXAMPLE_CONFIG)) {
    fs.copyFileSync(EXAMPLE_CONFIG, CONFIG_PATH);
  } else {
    fs.writeFileSync(
      CONFIG_PATH,
      JSON.stringify(
        { profileName: '我的工作台', snapshotIntervalSeconds: 120, repositories: [] },
        null,
        2,
      ),
      'utf8',
    );
  }
  console.log(`[code-workbench] 已生成配置：${CONFIG_PATH}`);
}

export function readMonitorConfig() {
  ensureUserConfig();
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

export function saveMonitorConfig(patch) {
  ensureUserConfig();
  const prev = readMonitorConfig();
  const next = {
    ...prev,
    ...patch,
    repositories: patch.repositories ?? prev.repositories,
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function loadRepos() {
  ensureUserConfig();
  const raw = readMonitorConfig();
  const repos = {};
  for (const item of raw.repositories ?? []) {
    if (!item?.path || !item?.key) continue;
    const absPath = expandHome(item.path);
    if (!fs.existsSync(absPath)) {
      console.warn(`[code-workbench] 路径不存在，已跳过：${item.key} → ${absPath}`);
      continue;
    }
    repos[item.key] = {
      key: item.key,
      label: item.label ?? item.key,
      purpose: item.note ?? '',
      absPath,
    };
  }
  return {
    profileName: raw.profileName ?? '我的工作台',
    snapshotIntervalSeconds: Number(raw.snapshotIntervalSeconds) || 120,
    repos,
    configPath: CONFIG_PATH,
    dataDir: DATA_DIR,
  };
}