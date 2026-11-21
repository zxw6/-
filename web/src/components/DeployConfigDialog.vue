<script setup>
import { ref, watch, computed } from 'vue';
import { useI18n } from '../i18n/index.js';
import { saveDeployTarget, openDeployConfig } from '../api.js';

const props = defineProps({
  open: { type: Boolean, default: false },
  project: { type: Object, default: null },
  remotes: { type: Array, default: () => [] },
  primaryRemote: { type: String, default: '' },
});

const emit = defineEmits(['close', 'saved']);

const { t } = useI18n();
const saving = ref(false);
const error = ref('');
const branch = ref('master');
const pushRemote = ref('');
const submitLabel = ref('');
const useBaota = ref(false);
const webhookUrl = ref('');
const baotaSitePath = ref('');
const webhookSecret = ref('');

const remoteOptions = computed(() => {
  const list = [...(props.remotes || [])];
  return list;
});

function remoteHint(r) {
  if (r.host === 'github') return 'GitHub';
  if (r.host === 'gitee') return 'Gitee';
  if (r.host === 'lanhu') return t('deploySiteLanhu');
  if (r.host === 'coding') return 'Coding';
  if (r.host === 'gitlab') return 'GitLab';
  return t('deploySiteOther');
}

watch(
  () => [props.open, props.project, props.primaryRemote],
  () => {
    if (!props.open || !props.project) return;
    error.value = '';
    branch.value = props.project.branch || 'master';
    const savedPush = props.project.pushRemote || props.project.gitRemote || '';
    pushRemote.value = savedPush || props.primaryRemote || '';
    submitLabel.value = props.project.submitLabel || '';
    useBaota.value = props.project.configTags?.includes('宝塔');
    webhookUrl.value = /你的域名/.test(props.project.webhookUrl || '') ? '' : props.project.webhookUrl || '';
    baotaSitePath.value = props.project.baotaSitePath || '';
    webhookSecret.value = props.project.webhookSecret || '';
  },
  { immediate: true },
);

watch(pushRemote, (name) => {
  if (submitLabel.value.trim()) return;
  const r = props.remotes?.find((x) => x.name === name);
  if (!r) return;
  submitLabel.value = remoteHint(r);
});

async function onSave() {
  if (!props.project?.repoKey) return;
  saving.value = true;
  error.value = '';
  try {
    if (useBaota.value && !webhookUrl.value.trim()) {
      error.value = t('deployCfgNeedWebhook');
      saving.value = false;
      return;
    }
    const label = submitLabel.value.trim();
    const res = await saveDeployTarget(props.project.repoKey, {
      label: props.project.label,
      branch: branch.value.trim() || 'master',
      pushRemote: pushRemote.value.trim(),
      gitRemote: pushRemote.value.trim(),
      submitLabel: label,
      gitHost: '',
      webhookUrl: useBaota.value ? webhookUrl.value.trim() : '',
      baotaSitePath: useBaota.value ? baotaSitePath.value.trim() : '',
      webhookSecret: useBaota.value ? webhookSecret.value.trim() : '',
    });
    if (!res.ok) {
      error.value = res.error || 'save failed';
      return;
    }
    emit('saved', res);
    emit('close');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="open" class="dc-backdrop" @click.self="emit('close')">
    <div class="dc-dialog" role="dialog">
      <header class="dc-head">
        <h2 class="dc-title">{{ t('deployCfgTitle') }}</h2>
        <p class="dc-sub">{{ project?.label }} · {{ project?.repoKey }}</p>
        <button type="button" class="dc-close" @click="emit('close')">×</button>
      </header>
      <div class="dc-body">
        <section class="dc-section">
          <h3 class="dc-section-title">{{ t('deployCfgSubmitSection') }}</h3>
          <p class="dc-hint">{{ t('deployCfgSubmitHint') }}</p>

          <ul v-if="remoteOptions.length" class="dc-remote-list">
            <li v-for="r in remoteOptions" :key="r.name">
              <code>{{ r.name }}</code>
              <span class="dc-remote-tag">{{ remoteHint(r) }}</span>
              <span class="dc-remote-url" :title="r.url">{{ r.url }}</span>
            </li>
          </ul>
          <p v-else class="dc-hint dc-hint--warn">{{ t('deployCfgNoRemote') }}</p>

          <label class="dc-field">
            <span>{{ t('deployCfgPushRemote') }}</span>
            <select v-model="pushRemote" class="dc-input">
              <option value="">{{ t('deployCfgPushFollowUpstream', { name: primaryRemote || 'origin' }) }}</option>
              <option v-for="r in remoteOptions" :key="r.name" :value="r.name">
                {{ r.name }} · {{ remoteHint(r) }} · {{ r.url }}
              </option>
            </select>
          </label>

          <label class="dc-field">
            <span>{{ t('deployCfgSubmitLabel') }}</span>
            <input
              v-model="submitLabel"
              class="dc-input"
              type="text"
              :placeholder="t('deployCfgSubmitLabelPh')"
            />
          </label>

          <label class="dc-field">
            <span>{{ t('deployKvBranch') }}</span>
            <input v-model="branch" class="dc-input" type="text" />
          </label>
        </section>

        <section class="dc-section dc-section--muted">
          <h3 class="dc-section-title">{{ t('deployCfgPublishSection') }}</h3>
          <label class="dc-check">
            <input v-model="useBaota" type="checkbox" />
            {{ t('deployCfgBaotaEnable') }}
          </label>
          <template v-if="useBaota">
            <label class="dc-field">
              <span>{{ t('deployKvWebhook') }}</span>
              <input v-model="webhookUrl" class="dc-input" type="url" />
            </label>
            <label class="dc-field">
              <span>{{ t('deployKvServer') }}</span>
              <input v-model="baotaSitePath" class="dc-input" type="text" />
            </label>
            <label class="dc-field">
              <span>{{ t('deployCfgToken') }}</span>
              <input v-model="webhookSecret" class="dc-input" type="text" />
            </label>
          </template>
          <p v-else class="dc-hint">{{ t('deployCfgPublishSkip') }}</p>
        </section>

        <p v-if="error" class="dc-error">{{ error }}</p>
      </div>
      <footer class="dc-foot">
        <button type="button" class="dc-btn dc-btn--ghost" @click="openDeployConfig('edit')">{{ t('deployCfgOpenJson') }}</button>
        <button type="button" class="dc-btn" :disabled="saving" @click="onSave">{{ t('deployCfgSave') }}</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.dc-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.dc-dialog {
  width: min(540px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: var(--dialog-bg);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-dialog);
}
.dc-head {
  position: relative;
  padding: 16px 18px 10px;
  border-bottom: 1px solid var(--border);
}
.dc-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
}
.dc-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.dc-close {
  position: absolute;
  top: 10px;
  right: 12px;
  border: none;
  background: none;
  font-size: 22px;
  cursor: pointer;
  color: var(--muted);
}
.dc-body {
  padding: 14px 18px;
}
.dc-section {
  margin-bottom: 16px;
}
.dc-section--muted {
  padding-top: 12px;
  border-top: 1px dashed var(--border);
}
.dc-section-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}
.dc-hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
}
.dc-hint--warn {
  color: #bf8700;
}
.dc-remote-list {
  list-style: none;
  margin: 0 0 12px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-muted);
  font-size: 11px;
  max-height: 120px;
  overflow: auto;
}
.dc-remote-list li {
  display: grid;
  grid-template-columns: auto auto 1fr;
  gap: 8px;
  align-items: baseline;
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
}
.dc-remote-list li:last-child {
  border-bottom: none;
}
.dc-remote-tag {
  color: var(--link);
  font-weight: 600;
}
.dc-remote-url {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
  font-family: ui-monospace, monospace;
}
.dc-check {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  margin-bottom: 10px;
}
.dc-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 10px 0;
  font-size: 12px;
  color: var(--muted);
}
.dc-input {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  background: var(--bg);
  color: var(--text);
}
.dc-error {
  color: #cf222e;
  font-size: 12px;
}
.dc-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid var(--border);
}
.dc-btn {
  border: none;
  border-radius: 8px;
  padding: 9px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  background: #24292f;
  color: #fff;
}
.dc-btn--ghost {
  background: var(--btn-secondary-bg);
  color: var(--text);
  border: 1px solid var(--border);
}
</style>