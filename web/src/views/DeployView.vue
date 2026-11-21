<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { useI18n } from '../i18n/index.js';
import {
  fetchDeployOverview,
  runDeploy,
  fetchDeployRemotes,
  fetchDeployDrafts,
  restoreDeployDraft,
  deleteDeployDraft,
  fetchDeployWorkspace,
  fetchDeployDiff,
  stageDeployFile,
} from '../api.js';
import DeployConfigDialog from '../components/DeployConfigDialog.vue';

const emit = defineEmits(['deploy-done']);

const { t } = useI18n();

const SELECT_KEY = 'code-workbench-deploy-project';

const configPath = ref('');
const projects = ref([]);
const metaById = ref({});
const selectedId = ref('');
const commitMessage = ref('');
const allowCommit = ref(true);
const pushToHost = ref('auto');
const gitRemote = ref('');
const remotes = ref([]);
const primaryPush = ref({ remote: '', url: '', hostLabel: '' });
const configOpen = ref(false);
const drafts = ref([]);
const workspace = ref(null);
const workspaceLoading = ref(false);
const selectedFile = ref(null);
const diffText = ref('');
const diffLoading = ref(false);
const running = ref(false);
const restoreBusy = ref(false);
const logs = ref([]);
const lastError = ref('');
const lastRunOk = ref(null);
const lastRunMs = ref(null);
const runStartedAt = ref(0);

const selectedProject = computed(() => projects.value.find((x) => x.id === selectedId.value));
const selectedTarget = selectedProject;
const targetMeta = computed(() => metaById.value[selectedId.value] ?? {});
const repoKey = computed(() => selectedTarget.value?.repoKey ?? '');

const pushHostOptions = computed(() => {
  const hosts = new Set();
  for (const r of remotes.value) {
    if (r.host === 'github' || r.host === 'gitee') hosts.add(r.host);
  }
  return [...hosts];
});

const filesToCommit = computed(() => {
  const ws = workspace.value;
  if (!ws?.files?.length) return [];
  return ws.files.filter((f) => f.staged || f.unstaged || f.status === 'untracked');
});

const footerStats = computed(() => ({
  projects: projects.value.length,
  pending: filesToCommit.value.length,
  failed: lastRunOk.value === false ? 1 : 0,
}));

const hasBaotaPublish = computed(() => {
  const tags = selectedTarget.value?.configTags ?? [];
  return tags.includes('宝塔');
});

const deploySteps = computed(() => {
  const text = logs.value.join('\n');
  const hit = (kw) => text.includes(kw);
  const site =
    selectedTarget.value?.submitLabel?.trim() ||
    selectedTarget.value?.configLabel ||
    t('deployStepPushSite');
  const pushLabel = t('deployStepPushTo', { site });
  const publishLabel = hasBaotaPublish.value ? t('deployStepPublish') : t('deployStepPublishSkip');
  const steps = [
    { key: 'draft', label: t('deployStepDraft'), done: hit('草稿箱') || lastRunOk.value === true },
    { key: 'commit', label: t('deployStepCommit'), done: hit('已提交') || hit('跳过 commit') || lastRunOk.value === true },
    { key: 'push', label: pushLabel, done: hit('push 完成') || hit('跳过 push') || lastRunOk.value === true },
    {
      key: 'webhook',
      label: publishLabel,
      skip: !hasBaotaPublish.value,
      done:
        hit('服务器响应') ||
        (!hasBaotaPublish.value &&
          (hit('未配置宝塔发布') || hit('仅完成代码仓库推送') || hit('push 完成'))) ||
        lastRunOk.value === true,
    },
  ];
  return steps;
});

const pipelineHint = computed(() => {
  if (running.value) return t('deployPipelineRunning');
  if (lastRunOk.value === true) return t('deployLastOk', { sec: ((lastRunMs.value || 0) / 1000).toFixed(1) });
  const site = selectedTarget.value?.configLabel;
  if (site && site !== t('deployStatusNone')) {
    return hasBaotaPublish.value ? t('deployPipelineHintCfgBoth', { site }) : t('deployPipelineHintCfgGit', { site });
  }
  return t('deployPipelineIdle');
});

const deployProgress = computed(() => {
  if (running.value) {
    const done = deploySteps.value.filter((s) => s.done).length;
    return Math.min(95, 12 + done * 22);
  }
  if (lastRunOk.value === true) return 100;
  if (lastRunOk.value === false) return Math.max(15, deploySteps.value.filter((s) => s.done).length * 25);
  return 0;
});

function statusLabel(f) {
  const map = {
    added: t('deployFileAdded'),
    modified: t('deployFileModified'),
    deleted: t('deployFileDeleted'),
    renamed: t('deployFileRenamed'),
    untracked: t('deployFileUntracked'),
  };
  return map[f.status] ?? f.status;
}

function statusBadge(f) {
  if (f.staged && f.unstaged) return t('deployFilePartial');
  if (f.staged) return t('deployFileStaged');
  return t('deployFileUnstaged');
}

function formatShortTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDraftTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function targetStatus(p) {
  if (p.id === selectedId.value && filesToCommit.value.length) {
    return { label: t('deployStatusPending'), tone: 'warn' };
  }
  const label = p.configLabel || t('deployStatusNone');
  return { label, tone: p.configTags?.length ? 'ok' : 'muted' };
}

const pushSiteText = computed(() => {
  const name = selectedTarget.value?.submitLabel?.trim();
  const r = remotes.value.find((x) => x.name === gitRemote.value);
  const host =
    name ||
    (r?.host === 'github'
      ? 'GitHub'
      : r?.host === 'gitee'
        ? 'Gitee'
        : r?.host === 'lanhu'
          ? '蓝湖'
          : primaryPush.value.hostLabel || '');
  const url = r?.url || primaryPush.value.url;
  if (!url && !host) return '—';
  return `${host}${url ? ` · ${url}` : ''}`;
});

function targetSubtitle(p) {
  if (p.localPath) {
    return p.localPath.length > 44 ? `${p.localPath.slice(0, 42)}…` : p.localPath;
  }
  const path = p.baotaSitePath || p.webhookUrl || p.repoKey;
  if (!path) return p.repoKey;
  try {
    if (path.startsWith('http')) return new URL(path).host;
  } catch {
    /* ignore */
  }
  return String(path).length > 42 ? `${String(path).slice(0, 40)}…` : path;
}

function pickProject(id) {
  selectedId.value = id;
  try {
    localStorage.setItem(SELECT_KEY, id);
  } catch {
    /* ignore */
  }
}

async function refreshWorkspace() {
  if (!repoKey.value) {
    workspace.value = null;
    return;
  }
  workspaceLoading.value = true;
  try {
    const res = await fetchDeployWorkspace(repoKey.value);
    workspace.value = res.ok ? res : null;
    if (selectedFile.value) {
      const still = res.files?.some((x) => x.path === selectedFile.value.path);
      if (!still) {
        selectedFile.value = null;
        diffText.value = '';
      }
    }
  } finally {
    workspaceLoading.value = false;
  }
}

async function loadOverview() {
  const res = await fetchDeployOverview();
  if (res.ok) {
    configPath.value = res.configPath ?? '';
    projects.value = res.projects ?? [];
    metaById.value = res.metaById ?? {};
    let next = selectedId.value;
    if (!projects.value.some((p) => p.id === next)) {
      try {
        const saved = localStorage.getItem(SELECT_KEY);
        if (saved && projects.value.some((p) => p.id === saved)) next = saved;
      } catch {
        /* ignore */
      }
    }
    if (!next && projects.value.length) next = projects.value[0].id;
    if (next) pickProject(next);
  }
}

async function loadRemotesAndDrafts() {
  const tgt = selectedTarget.value;
  if (!tgt?.repoKey) {
    remotes.value = [];
    drafts.value = [];
    return;
  }
  const [rRes, dRes] = await Promise.all([
    fetchDeployRemotes(tgt.repoKey),
    fetchDeployDrafts(tgt.repoKey),
  ]);
  remotes.value = rRes.ok ? rRes.remotes ?? [] : [];
  primaryPush.value = {
    remote: rRes.primaryRemote ?? '',
    url: rRes.primaryUrl ?? '',
    hostLabel: rRes.primaryHostLabel ?? '',
  };
  drafts.value = dRes.ok ? dRes.items ?? [] : [];
  const saved = tgt.pushRemote || tgt.gitRemote || '';
  const prefer = saved || rRes.primaryRemote || 'origin';
  const hit = remotes.value.find((x) => x.name === prefer);
  gitRemote.value = hit?.name ?? remotes.value[0]?.name ?? '';
  await refreshWorkspace();
}

watch(selectedId, () => {
  selectedFile.value = null;
  diffText.value = '';
  gitRemote.value = '';
  try {
    if (selectedId.value) localStorage.setItem(SELECT_KEY, selectedId.value);
  } catch {
    /* ignore */
  }
  void loadRemotesAndDrafts();
});

async function pickFile(f) {
  selectedFile.value = f;
  diffLoading.value = true;
  diffText.value = '';
  try {
    const mode = f.staged && !f.unstaged ? 'staged' : f.staged ? 'auto' : 'unstaged';
    const res = await fetchDeployDiff(repoKey.value, f.path, mode);
    diffText.value = res.ok ? res.diff || t('deployDiffEmpty') : res.error || '';
  } finally {
    diffLoading.value = false;
  }
}

async function toggleStage(f, e) {
  e?.stopPropagation?.();
  const res = await stageDeployFile(repoKey.value, f.path, !f.staged);
  if (res.ok) {
    workspace.value = res;
    if (selectedFile.value?.path === f.path) await pickFile({ ...f, staged: !f.staged });
  }
}

function clearFileDetail() {
  selectedFile.value = null;
  diffText.value = '';
}

async function onRun() {
  if (!selectedId.value) {
    lastError.value = t('deployNoTarget');
    return;
  }
  running.value = true;
  lastError.value = '';
  logs.value = [];
  lastRunOk.value = null;
  runStartedAt.value = Date.now();
  try {
    const body = {
      repoKey: selectedProject.value?.repoKey ?? '',
      commitMessage: commitMessage.value,
      allowCommit: allowCommit.value,
      push: true,
    };
    if (gitRemote.value && gitRemote.value !== primaryPush.value.remote) {
      body.gitRemote = gitRemote.value;
    } else if (gitRemote.value) {
      body.gitRemote = gitRemote.value;
    }
    if (pushToHost.value && pushToHost.value !== 'auto') {
      body.gitHost = pushToHost.value;
      body.gitHostOverride = true;
    }
    const res = await runDeploy(body);
    logs.value = res.logs ?? [];
    lastRunMs.value = Date.now() - runStartedAt.value;
  if (!res.ok) {
      lastError.value = res.error || 'failed';
      lastRunOk.value = false;
    } else {
      lastRunOk.value = true;
      await loadOverview();
      await loadRemotesAndDrafts();
      emit('deploy-done');
    }
  } catch (e) {
    lastError.value = e?.message ?? 'network';
    lastRunOk.value = false;
    lastRunMs.value = Date.now() - runStartedAt.value;
  } finally {
    running.value = false;
  }
}

async function onRestoreDraft(draft) {
  if (!window.confirm(t('deployDraftRestoreConfirm', { hash: draft.shortHash }))) return;
  restoreBusy.value = true;
  try {
    const res = await restoreDeployDraft(draft.id);
    logs.value = res.logs ?? [];
    if (!res.ok) lastError.value = res.error || 'failed';
    else await loadRemotesAndDrafts();
  } finally {
    restoreBusy.value = false;
  }
}

function openConfigDialog() {
  configOpen.value = true;
}

async function onConfigSaved() {
  await loadOverview();
  await loadRemotesAndDrafts();
}

function remoteLabel(r) {
  if (r.host === 'github') return `GitHub · ${r.name}`;
  if (r.host === 'gitee') return `Gitee · ${r.name}`;
  return r.name;
}

onMounted(async () => {
  await loadOverview();
  await loadRemotesAndDrafts();
});
</script>

<template>
  <div class="hub">
    <section class="hub-shell">
      <aside class="hub-col hub-col--projects">
        <header class="hub-col-head">
          <h2 class="hub-col-title">{{ t('deployProjectList') }}</h2>
          <span class="hub-count">{{ projects.length }}</span>
        </header>
        <div class="hub-col-scroll">
          <button
            v-for="p in projects"
            :key="p.id"
            type="button"
            class="hub-proj"
            :class="{ active: selectedId === p.id }"
            @click="pickProject(p.id)"
          >
            <div class="hub-proj-top">
              <strong class="hub-proj-name">{{ p.label }}</strong>
              <span class="hub-pill" :data-tone="targetStatus(p).tone">{{ targetStatus(p).label }}</span>
            </div>
            <p class="hub-proj-path">{{ targetSubtitle(p) }}</p>
            <p class="hub-proj-meta">
              <span class="hub-proj-key">{{ p.repoKey }}</span>
              <span>{{ formatShortTime(metaById[p.id]?.lastDeployAt) }}</span>
            </p>
          </button>
          <p v-if="!projects.length" class="hub-empty">{{ t('deployNoReposHint') }}</p>
        </div>
        <footer class="hub-col-foot">
          <span class="hub-foot-hint">{{ t('deployNewProjectHint') }}</span>
        </footer>
      </aside>

      <main class="hub-col hub-col--workspace" v-if="selectedTarget">
        <header class="hub-work-head">
          <div class="hub-work-head-main">
            <label class="hub-project-picker">
              <span class="hub-project-picker-label">{{ t('deployPickProject') }}</span>
              <select :value="selectedId" class="hub-project-select" @change="pickProject($event.target.value)">
                <option v-for="p in projects" :key="p.id" :value="p.id">
                  {{ p.label }}（{{ p.repoKey }}）· {{ p.configLabel || t('deployStatusNone') }}
                </option>
              </select>
            </label>
            <p class="hub-work-sub">{{ workspace?.branch || selectedTarget.branch }} · {{ workspace?.shortHash || '…' }}</p>
          </div>
          <button type="button" class="hub-ghost-btn" @click="openConfigDialog">{{ t('deployEditConfig') }}</button>
        </header>

        <dl class="hub-kv">
          <div class="hub-kv-row">
            <dt>{{ t('deployKvGitSite') }}</dt>
            <dd :title="pushSiteText">
              {{ pushSiteText }}
              <span v-if="primaryPush.remote" class="hub-kv-note">{{ t('deployGitPrimary', { name: primaryPush.remote }) }}</span>
            </dd>
          </div>
          <div class="hub-kv-row">
            <dt>{{ t('deployKvDeployCfg') }}</dt>
            <dd>{{ selectedTarget.configLabel || t('deployStatusNone') }}</dd>
          </div>
          <div class="hub-kv-row">
            <dt>{{ t('deployKvServer') }}</dt>
            <dd :title="selectedTarget.baotaSitePath">{{ selectedTarget.baotaSitePath || '—' }}</dd>
          </div>
          <div class="hub-kv-row">
            <dt>{{ t('deployKvLocal') }}</dt>
            <dd :title="targetMeta.localPath">{{ targetMeta.localPath || '—' }}</dd>
          </div>
          <div class="hub-kv-row">
            <dt>{{ t('deployKvBranch') }}</dt>
            <dd>{{ selectedTarget.branch || 'master' }}</dd>
          </div>
          <div class="hub-kv-row">
            <dt>{{ t('deployKvPushOverride') }}</dt>
            <dd>
              <select v-if="remotes.length" v-model="gitRemote" class="hub-inline-select">
                <option v-for="r in remotes" :key="r.name" :value="r.name">{{ remoteLabel(r) }} · {{ r.url }}</option>
              </select>
              <span v-else>—</span>
            </dd>
          </div>
          <div class="hub-kv-row" v-if="pushHostOptions.length > 1">
            <dt>{{ t('deployPickHost') }}</dt>
            <dd>
              <select v-model="pushToHost" class="hub-inline-select">
                <option value="auto">{{ t('deployHostFollowRepo') }}</option>
                <option v-if="pushHostOptions.includes('gitee')" value="gitee">Gitee</option>
                <option v-if="pushHostOptions.includes('github')" value="github">GitHub</option>
              </select>
            </dd>
          </div>
          <div class="hub-kv-row">
            <dt>{{ t('deployKvWebhook') }}</dt>
            <dd :title="selectedTarget.webhookUrl">{{ selectedTarget.webhookUrl || t('deployWebhookSkip') }}</dd>
          </div>
          <div class="hub-kv-row">
            <dt>{{ t('deployKvLast') }}</dt>
            <dd>
              <template v-if="targetMeta.lastDeployAt">
                {{ formatShortTime(targetMeta.lastDeployAt) }}
                <span v-if="targetMeta.lastDeployShort"> · {{ targetMeta.lastDeployShort }}</span>
              </template>
              <span v-else>—</span>
            </dd>
          </div>
        </dl>

        <section class="hub-section">
          <div class="hub-section-head">
            <h3>{{ t('deployColPending') }}</h3>
            <button type="button" class="hub-ghost-btn hub-ghost-btn--sm" :disabled="workspaceLoading" @click="refreshWorkspace">
              {{ workspaceLoading ? '…' : t('deployRefresh') }}
            </button>
          </div>
          <p v-if="workspace?.clean" class="hub-empty hub-empty--inline">{{ t('deployWorkspaceClean') }}</p>
          <table v-else class="hub-table">
            <thead>
              <tr>
                <th class="col-stage" />
                <th>{{ t('deployTableFile') }}</th>
                <th>{{ t('deployTableState') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="f in filesToCommit"
                :key="f.path"
                :class="{ active: selectedFile?.path === f.path }"
                @click="pickFile(f)"
              >
                <td>
                  <button type="button" class="hub-stage" @click="toggleStage(f, $event)">{{ f.staged ? '−' : '+' }}</button>
                </td>
                <td class="col-path" :title="f.path">{{ f.path }}</td>
                <td>
                  <span class="hub-tag">{{ statusLabel(f) }}</span>
                  <span class="hub-tag hub-tag--muted">{{ statusBadge(f) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section class="hub-section hub-section--commit">
          <label class="hub-commit-label">{{ t('deployCommitMsg') }}</label>
          <input v-model="commitMessage" class="hub-input" type="text" :placeholder="t('deployCommitPlaceholder')" />
          <label class="hub-check">
            <input v-model="allowCommit" type="checkbox" />
            {{ t('deployAllowCommit') }}
          </label>
        </section>

        <section v-if="drafts.length" class="hub-section hub-section--drafts">
          <h3 class="hub-section-title">{{ t('deployDraftsTitle') }}</h3>
          <ul class="hub-draft-list">
            <li v-for="d in drafts.slice(0, 5)" :key="d.id">
              <span>#{{ d.id }} {{ d.shortHash }}</span>
              <span>{{ formatDraftTime(d.createdAt) }}</span>
              <button type="button" :disabled="restoreBusy" @click="onRestoreDraft(d)">{{ t('deployDraftRestore') }}</button>
            </li>
          </ul>
        </section>
      </main>
      <main v-else class="hub-col hub-col--workspace">
        <p class="hub-empty">{{ t('deployNoTargetHint') }}</p>
      </main>

      <aside class="hub-col hub-col--detail">
        <div v-if="deployProgress > 0 || running" class="hub-progress">
          <div class="hub-progress-bar" :style="{ width: `${deployProgress}%` }" />
          <span v-if="lastRunMs != null && !running" class="hub-progress-time">{{ (lastRunMs / 1000).toFixed(1) }}s</span>
        </div>

        <template v-if="selectedFile">
          <header class="hub-detail-head">
            <button type="button" class="hub-back" @click="clearFileDetail">‹</button>
            <div>
              <h2 class="hub-detail-title">{{ selectedFile.path.split('/').pop() }}</h2>
              <p class="hub-detail-sub">{{ statusLabel(selectedFile) }} · {{ statusBadge(selectedFile) }}</p>
            </div>
          </header>
          <p class="hub-detail-path">{{ selectedFile.path }}</p>
          <p v-if="diffLoading" class="hub-empty">{{ t('deployDiffLoading') }}</p>
          <pre v-else class="hub-diff">{{ diffText }}</pre>
        </template>

        <template v-else>
          <header class="hub-detail-head">
            <h2 class="hub-detail-title">{{ t('deployColPipeline') }}</h2>
            <p class="hub-detail-sub" :class="{ 'hub-detail-sub--live': running }">{{ pipelineHint }}</p>
          </header>

          <ol class="hub-steps" :class="{ 'hub-steps--live': running }">
            <li
              v-for="(step, i) in deploySteps"
              :key="step.key"
              :class="{
                done: step.done,
                active: running && !step.done && (i === 0 || deploySteps[i - 1]?.done),
                skipped: step.skip && !running,
              }"
            >
              <span class="hub-step-idx">{{ step.skip && !step.done ? '—' : i + 1 }}</span>
              <span class="hub-step-label">{{ step.label }}</span>
              <span v-if="step.done && step.skip" class="hub-step-state">{{ t('deployStepSkipped') }}</span>
              <span v-else-if="step.done" class="hub-step-state">{{ t('deployStepDone') }}</span>
              <span v-else-if="running" class="hub-step-state hub-step-state--pulse">{{ t('deployStepRunning') }}</span>
              <span v-else class="hub-step-state">{{ t('deployStepIdle') }}</span>
            </li>
          </ol>

          <div v-if="logs.length" class="hub-log-box">
            <p v-for="(line, i) in logs" :key="i">{{ line }}</p>
          </div>
          <p v-if="lastError" class="hub-error">{{ lastError }}</p>
          <p v-else-if="lastRunOk" class="hub-success">{{ t('deployLastOk', { sec: ((lastRunMs || 0) / 1000).toFixed(1) }) }}</p>
        </template>

        <footer class="hub-detail-foot">
          <button type="button" class="hub-primary" :disabled="running || !selectedId" @click="onRun">
            {{ running ? t('deployRunning') : t('deployRunShort') }}
          </button>
          <p class="hub-foot-note">{{ t('deployPipelineFoot') }}</p>
        </footer>
      </aside>
    </section>

    <footer class="hub-statusbar">
      <span>{{ t('deployFooterStats', { n: footerStats.projects, p: footerStats.pending, f: footerStats.failed }) }}</span>
      <span v-if="configPath" class="hub-statusbar-path">{{ configPath }}</span>
    </footer>

    <DeployConfigDialog
      :open="configOpen"
      :project="selectedProject"
      :remotes="remotes"
      :primary-remote="primaryPush.remote"
      @close="configOpen = false"
      @saved="onConfigSaved"
    />
  </div>
</template>

<style scoped>
.hub {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: 0;
}

.hub-shell {
  display: grid;
  grid-template-columns: 272px minmax(360px, 1fr) minmax(300px, 360px);
  flex: 1;
  min-height: calc(100vh - 148px);
  border: 1px solid var(--border);
  border-radius: 14px;
  overflow: hidden;
  background: var(--panel);
  box-shadow: var(--shadow-popover);
}

.hub-col {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.hub-col--projects {
  background: var(--surface-muted);
  border-right: 1px solid var(--border);
}

.hub-col--workspace {
  overflow: auto;
  padding: 20px 22px 24px;
  background: var(--panel);
}

.hub-col--detail {
  border-left: 1px solid var(--border);
  background: var(--surface-subtle);
  position: relative;
  overflow: hidden;
}

.hub-col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 14px 10px;
  border-bottom: 1px solid var(--border);
}

.hub-col-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}

.hub-count {
  font-size: 11px;
  color: var(--muted);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 8px;
}

.hub-col-scroll {
  flex: 1;
  overflow: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hub-proj {
  text-align: left;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 12px 12px 10px;
  background: var(--panel);
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
  box-shadow: 0 1px 2px rgba(31, 35, 40, 0.04);
}

.hub-proj:hover {
  border-color: var(--border);
}

.hub-proj.active {
  border-color: var(--link);
  background: color-mix(in srgb, var(--link) 8%, var(--panel));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--link) 25%, transparent);
}

.hub-proj-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.hub-proj-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.hub-pill {
  flex-shrink: 0;
  font-size: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--bg);
  color: var(--muted);
}

.hub-pill[data-tone='ok'] {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 40%, var(--border));
  background: color-mix(in srgb, var(--accent) 12%, var(--panel));
}

.hub-pill[data-tone='warn'] {
  color: #bf8700;
  border-color: #d4a72c66;
  background: #fff8c569;
}

[data-theme='dark'] .hub-pill[data-tone='warn'] {
  background: rgba(191, 135, 0, 0.15);
}

.hub-proj-path {
  margin: 6px 0 0;
  font-size: 11px;
  color: var(--muted);
  word-break: break-all;
}

.hub-proj-meta {
  margin: 4px 0 0;
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
  color: var(--text-tertiary);
}

.hub-proj-key {
  font-family: ui-monospace, monospace;
}

.hub-project-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 6px;
}

.hub-project-picker-label {
  font-size: 11px;
  color: var(--muted);
}

.hub-project-select {
  min-width: min(100%, 420px);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 15px;
  font-weight: 600;
  background: var(--bg);
  color: var(--text);
}

.hub-banner {
  margin: 0 0 14px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--link) 8%, var(--panel));
  font-size: 12px;
  line-height: 1.5;
  color: var(--text);
}

.hub-col-foot {
  padding: 10px 14px 12px;
  border-top: 1px solid var(--border);
  font-size: 11px;
  color: var(--muted);
}

.hub-work-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.hub-work-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.hub-work-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
  font-family: ui-monospace, monospace;
}

.hub-ghost-btn {
  border: 1px solid var(--border);
  background: var(--btn-secondary-bg);
  color: var(--text);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}

.hub-ghost-btn--sm {
  padding: 4px 10px;
  font-size: 11px;
}

.hub-kv {
  margin: 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface-muted);
}

.hub-kv-row {
  display: grid;
  grid-template-columns: 108px 1fr;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}

.hub-kv-row:last-child {
  border-bottom: none;
}

.hub-kv-row dt {
  margin: 0;
  color: var(--muted);
}

.hub-kv-row dd {
  margin: 0;
  color: var(--text);
  word-break: break-all;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 11px;
}

.hub-kv-note {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: var(--muted);
  font-family: system-ui, sans-serif;
}

.hub-inline-select {
  width: 100%;
  max-width: 280px;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  background: var(--panel);
  color: var(--text);
}

.hub-section {
  margin-bottom: 16px;
}

.hub-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.hub-section-head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.hub-section-title {
  margin: 0 0 8px;
  font-size: 14px;
}

.hub-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.hub-table th {
  text-align: left;
  padding: 8px 10px;
  background: var(--surface-muted);
  color: var(--muted);
  font-weight: 500;
  border-bottom: 1px solid var(--border);
}

.hub-table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

.hub-table tbody tr {
  cursor: pointer;
}

.hub-table tbody tr:hover,
.hub-table tbody tr.active {
  background: color-mix(in srgb, var(--link) 10%, var(--panel));
}

.hub-table .col-stage {
  width: 36px;
}

.hub-table .col-path {
  max-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, monospace;
  font-size: 11px;
}

.hub-stage {
  width: 24px;
  height: 24px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--panel);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.hub-tag {
  display: inline-block;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  margin-right: 4px;
  background: color-mix(in srgb, var(--link) 12%, var(--panel));
}

.hub-tag--muted {
  background: var(--border);
}

.hub-section--commit {
  border-top: 1px solid var(--border);
  padding-top: 14px;
}

.hub-commit-label {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 6px;
}

.hub-input {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 13px;
  background: var(--bg);
  color: var(--text);
  margin-bottom: 10px;
}

.hub-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.hub-draft-list {
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 11px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hub-draft-list li {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.hub-draft-list button {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
  background: var(--panel);
}

.hub-col--detail {
  display: flex;
  flex-direction: column;
  padding: 0;
}

.hub-progress {
  position: relative;
  height: 4px;
  background: var(--border);
}

.hub-progress-bar {
  height: 100%;
  background: var(--link);
  transition: width 0.35s ease;
}

.hub-progress-time {
  position: absolute;
  right: 12px;
  top: 10px;
  font-size: 22px;
  font-weight: 600;
  color: var(--text);
}

.hub-detail-head {
  padding: 18px 16px 0;
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.hub-detail-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}

.hub-detail-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.hub-back {
  border: none;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: var(--muted);
  padding: 0 4px 0 0;
}

.hub-detail-path {
  margin: 0;
  padding: 8px 16px;
  font-size: 11px;
  color: var(--muted);
  word-break: break-all;
  font-family: ui-monospace, monospace;
}

.hub-steps {
  list-style: none;
  margin: 12px 0 0;
  padding: 0 16px;
  flex: 1;
  overflow: auto;
}

.hub-steps li {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}

.hub-step-idx {
  width: 24px;
  height: 24px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  color: var(--muted);
}

.hub-steps li.done .hub-step-idx {
  background: color-mix(in srgb, var(--accent) 20%, var(--panel));
  border-color: var(--accent);
  color: var(--accent);
}

.hub-steps li.active .hub-step-idx {
  border-color: var(--link);
  color: var(--link);
  animation: hub-step-pulse 1.2s ease-in-out infinite;
}

.hub-steps li.skipped {
  opacity: 0.65;
}

.hub-detail-sub--live {
  color: var(--link);
}

.hub-step-state--pulse {
  color: var(--link);
  animation: hub-step-pulse 1.2s ease-in-out infinite;
}

@keyframes hub-step-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.45;
  }
}

.hub-step-state {
  font-size: 11px;
  color: var(--muted);
}

.hub-steps li.done .hub-step-state {
  color: var(--accent);
}

.hub-log-box {
  margin: 8px 16px 0;
  max-height: 140px;
  overflow: auto;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg);
  font-size: 11px;
  line-height: 1.45;
}

.hub-log-box p {
  margin: 0 0 4px;
}

.hub-error {
  margin: 10px 16px 0;
  font-size: 12px;
  color: #cf222e;
}

.hub-success {
  margin: 10px 16px 0;
  font-size: 12px;
  color: var(--accent);
}

.hub-diff {
  margin: 0 16px 16px;
  flex: 1;
  overflow: auto;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  font-size: 11px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, Consolas, monospace;
  max-height: calc(100vh - 280px);
}

.hub-detail-foot {
  margin-top: auto;
  padding: 14px 16px 16px;
  border-top: 1px solid var(--border);
  background: var(--panel);
}

.hub-primary {
  width: 100%;
  border: none;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: #fff;
  background: #1f2328;
}

[data-theme='light'] .hub-primary {
  background: #24292f;
}

.hub-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.hub-foot-note {
  margin: 8px 0 0;
  text-align: center;
  font-size: 11px;
  color: var(--muted);
}

.hub-empty {
  margin: 12px;
  font-size: 12px;
  color: var(--muted);
}

.hub-empty--inline {
  margin: 0 0 8px;
}

.hub-statusbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--panel);
  font-size: 11px;
  color: var(--muted);
}

.hub-statusbar-path {
  font-family: ui-monospace, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 50%;
}

@media (max-width: 1100px) {
  .hub-shell {
    grid-template-columns: 1fr;
    grid-auto-rows: auto;
    min-height: auto;
  }
  .hub-col--projects {
    max-height: 220px;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .hub-col--detail {
    border-left: none;
    border-top: 1px solid var(--border);
    min-height: 320px;
  }
}
</style>