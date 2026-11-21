<!-- 样式参考 Uiverse.io by andrew-demchenk0 -->
<script setup>
import { ref, computed } from 'vue';
import { useI18n } from '../i18n/index.js';
import { fetchGitSubmissions, syncGitSubmissions } from '../api.js';
import { filterGitSubmissions } from '../utils/git-submission-filter.js';
import GitSubmissionTable from './GitSubmissionTable.vue';
import GitSubmissionFilters from './GitSubmissionFilters.vue';

const emit = defineEmits(['refresh']);

const { t } = useI18n();

const open = ref(false);
const items = ref([]);
const loading = ref(false);
const syncing = ref(false);
const userQuery = ref('');
const branchQuery = ref('');

const filteredItems = computed(() => filterGitSubmissions(items.value, userQuery.value, branchQuery.value));

async function load(sync) {
  loading.value = true;
  try {
    const res = await fetchGitSubmissions({ limit: 120, sync: sync === true });
    if (res.ok) items.value = res.items ?? [];
  } finally {
    loading.value = false;
  }
}

async function openDialog() {
  open.value = true;
  userQuery.value = '';
  branchQuery.value = '';
  document.body.style.overflow = 'hidden';
  await load(true);
  emit('refresh');
}

function closeDialog() {
  open.value = false;
  document.body.style.overflow = '';
}

async function refresh() {
  syncing.value = true;
  try {
    const res = await syncGitSubmissions();
    if (res.ok) items.value = res.items ?? [];
    emit('refresh');
  } finally {
    syncing.value = false;
  }
}

function onBackdrop(e) {
  if (e.target === e.currentTarget) closeDialog();
}

defineExpose({ openDialog, load });
</script>

<template>
  <div class="git-launch">
    <button type="button" class="git-launch-btn" :title="t('gitOpenHint')" @click="openDialog">
      <svg
        class="git-launch-btn__icon"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 56.6934 56.6934"
        aria-hidden="true"
      >
        <path
          d="M51.981,24.4812c-7.7173-0.0038-15.4346-0.0019-23.1518-0.001c0.001,3.2009-0.0038,6.4018,0.0019,9.6017  c4.4693-0.001,8.9386-0.0019,13.407,0c-0.5179,3.0673-2.3408,5.8723-4.9258,7.5991c-1.625,1.0926-3.492,1.8018-5.4168,2.139  c-1.9372,0.3306-3.9389,0.3729-5.8713-0.0183c-1.9651-0.3921-3.8409-1.2108-5.4773-2.3649  c-2.6166-1.8383-4.6135-4.5279-5.6388-7.5549c-1.0484-3.0788-1.0561-6.5046,0.0048-9.5805  c0.7361-2.1679,1.9613-4.1705,3.5708-5.8002c1.9853-2.0324,4.5664-3.4853,7.3473-4.0811c2.3812-0.5083,4.8921-0.4113,7.2234,0.294  c1.9815,0.6016,3.8082,1.6874,5.3044,3.1163c1.5125-1.5039,3.0173-3.0164,4.527-4.5231c0.7918-0.811,1.624-1.5865,2.3908-2.4196  c-2.2928-2.1218-4.9805-3.8274-7.9172-4.9056C32.0723,4.0363,26.1097,3.995,20.7871,5.8372  C14.7889,7.8907,9.6815,12.3763,6.8497,18.0459c-0.9859,1.9536-1.7057,4.0388-2.1381,6.1836  C3.6238,29.5732,4.382,35.2707,6.8468,40.1378c1.6019,3.1768,3.8985,6.001,6.6843,8.215c2.6282,2.0958,5.6916,3.6439,8.9396,4.5078  c4.0984,1.0993,8.461,1.0743,12.5864,0.1355c3.7284-0.8581,7.256-2.6397,10.0725-5.24c2.977-2.7358,5.1006-6.3403,6.2249-10.2138  C52.5807,33.3171,52.7498,28.8064,51.981,24.4812z"
        />
      </svg>
    </button>
    <span class="git-launch-label">Git</span>

    <Teleport to="body">
      <div v-if="open" class="git-dialog-backdrop" @click="onBackdrop">
        <div class="git-dialog" role="dialog" aria-modal="true" :aria-label="t('gitRecordsTitle')" @click.stop>
          <header class="git-dialog__head">
            <h2 class="git-dialog__title">{{ t('gitRecordsTitle') }}</h2>
            <div class="git-dialog__actions">
              <button type="button" class="git-dialog__sync" :disabled="syncing" @click="refresh">
                {{ syncing ? t('gitSyncing') : t('gitSync') }}
              </button>
              <button type="button" class="git-dialog__close" :aria-label="t('close')" @click="closeDialog">✕</button>
            </div>
          </header>
          <p class="git-dialog__hint">{{ t('gitRecordsHint') }}</p>
          <GitSubmissionFilters v-model:user-query="userQuery" v-model:branch-query="branchQuery" :items="items" />
          <div v-if="loading" class="git-dialog__scroll">
            <p class="git-dialog__loading">{{ t('loading') }}</p>
          </div>
          <div v-else class="git-dialog__scroll">
            <p v-if="!filteredItems.length" class="git-dialog__loading">
              {{ items.length ? t('gitNoFilterMatch') : t('gitEmpty') }}
            </p>
            <GitSubmissionTable v-else :items="filteredItems" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.git-launch {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.git-launch-btn {
  --bg-color: #fff;
  --main-color: #323232;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 100%;
  border: 2px solid var(--main-color);
  background-color: var(--bg-color);
  box-shadow: 4px 4px var(--main-color);
  display: flex;
  justify-content: center;
  align-items: center;
  transition: all 0.2s;
  cursor: pointer;
  padding: 0;
}

:global([data-theme='dark']) .git-launch-btn {
  --bg-color: #f6f8fa;
}

.git-launch-btn:active {
  box-shadow: 0 0 var(--main-color);
  transform: translate(3px, 3px);
}

.git-launch-btn__icon {
  width: 22px;
  height: 22px;
  fill: var(--main-color);
}

.git-launch-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--text);
  line-height: 1;
  white-space: nowrap;
}

.git-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1250;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(12, 17, 26, 0.65);
  backdrop-filter: blur(6px);
}

.git-dialog {
  width: min(980px, 100%);
  max-height: min(88vh, 720px);
  display: flex;
  flex-direction: column;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--panel);
  padding: 16px 18px 18px;
  overflow: hidden;
}

.git-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.git-dialog__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.git-dialog__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.git-dialog__sync {
  border: 1px solid var(--border);
  background: var(--bg);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
  color: var(--text);
}

.git-dialog__close {
  border: none;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: var(--muted);
  padding: 4px 8px;
}

.git-dialog__hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: var(--muted);
}

.git-dialog__loading {
  margin: 24px;
  text-align: center;
  color: var(--muted);
}

.git-dialog__scroll {
  flex: 1;
  min-height: 0;
  max-height: min(58vh, 520px);
  overflow: auto;
  overflow-x: auto;
  scrollbar-color: var(--scrollbar-thumb, #888) transparent;
  scrollbar-width: thin;
}

.git-dialog__scroll :deep(.git-table-wrap) {
  max-height: none;
}
</style>