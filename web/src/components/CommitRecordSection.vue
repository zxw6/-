<script setup>

import { ref, computed, watch, onMounted } from 'vue';

import { useI18n } from '../i18n/index.js';

import { fetchGitSubmissions, syncGitSubmissions } from '../api.js';

import { filterGitSubmissions } from '../utils/git-submission-filter.js';

import GitSubmissionTable from './GitSubmissionTable.vue';

import GitSubmissionFilters from './GitSubmissionFilters.vue';



const STORAGE_KEY = 'code-workbench-git-records-open';



const props = defineProps({

  refreshKey: { type: Number, default: 0 },

});



const { t } = useI18n();



const items = ref([]);

const loading = ref(true);

const syncing = ref(false);

const sectionOpen = ref(true);

const userQuery = ref('');

const branchQuery = ref('');



const filteredItems = computed(() => filterGitSubmissions(items.value, userQuery.value, branchQuery.value));



function readOpenPref() {

  try {

    const v = localStorage.getItem(STORAGE_KEY);

    if (v === '0') sectionOpen.value = false;

    else if (v === '1') sectionOpen.value = true;

  } catch {

    /* ignore */

  }

}



function toggleOpen() {

  sectionOpen.value = !sectionOpen.value;

  try {

    localStorage.setItem(STORAGE_KEY, sectionOpen.value ? '1' : '0');

  } catch {

    /* ignore */

  }

}



async function load(sync = false) {

  loading.value = true;

  try {

    const res = await fetchGitSubmissions({ limit: 200, sync });

    if (res.ok) items.value = res.items ?? [];

  } finally {

    loading.value = false;

  }

}



async function refresh() {

  syncing.value = true;

  try {

    const res = await syncGitSubmissions();

    if (res.ok) items.value = res.items ?? [];

  } finally {

    syncing.value = false;

  }

}



onMounted(() => {

  readOpenPref();

  void load(true);

});



watch(

  () => props.refreshKey,

  () => void load(false),

);

</script>



<template>

  <section class="commit-records">

    <div class="commit-records__shell">

      <header class="commit-records__head">

        <button

          type="button"

          class="commit-records__toggle"

          :aria-expanded="sectionOpen"

          @click="toggleOpen"

        >

          <span class="chevron" :class="{ open: sectionOpen }">›</span>

          <h2 class="commit-records__title">{{ t('gitRecordsTitle') }}</h2>

          <span class="commit-records__count">{{ filteredItems.length }}/{{ items.length }}</span>

        </button>

        <button type="button" class="commit-records__sync" :disabled="syncing" @click="refresh">

          {{ syncing ? t('gitSyncing') : t('gitSync') }}

        </button>

      </header>



      <div v-show="sectionOpen" class="commit-records__body">

        <p class="commit-records__hint">{{ t('gitRecordsSectionHint') }}</p>

        <GitSubmissionFilters v-model:user-query="userQuery" v-model:branch-query="branchQuery" :items="items" />

        <div class="commit-records__scroll scroll-panel">

          <p v-if="loading" class="commit-records__loading">{{ t('loading') }}</p>

          <p v-else-if="!filteredItems.length" class="commit-records__empty">

            {{ items.length ? t('gitNoFilterMatch') : t('gitEmpty') }}

          </p>

          <GitSubmissionTable v-else :items="filteredItems" compact />

        </div>

      </div>

    </div>

  </section>

</template>



<style scoped>

.commit-records {

  margin-top: 24px;

}



.commit-records__shell {

  border: 1px solid var(--border);

  border-radius: 12px;

  background: var(--panel);

  overflow: hidden;

}



.commit-records__head {

  display: flex;

  align-items: center;

  justify-content: space-between;

  gap: 12px;

  padding: 10px 12px 10px 8px;

  border-bottom: 1px solid var(--border);

  background: var(--bg);

}



.commit-records__toggle {

  display: flex;

  align-items: center;

  gap: 8px;

  flex: 1;

  min-width: 0;

  border: none;

  background: transparent;

  cursor: pointer;

  padding: 4px 8px;

  text-align: left;

  color: inherit;

}



.commit-records__toggle:hover {

  background: var(--surface-muted, rgba(127, 127, 127, 0.08));

  border-radius: 8px;

}



.commit-records__title {

  margin: 0;

  font-size: 16px;

  font-weight: 600;

  color: var(--text);

}



.commit-records__count {

  font-size: 11px;

  color: var(--muted);

  padding: 2px 8px;

  border-radius: 999px;

  border: 1px solid var(--border);

  flex-shrink: 0;

}



.commit-records__sync {

  border: 1px solid var(--border);

  background: var(--panel);

  border-radius: 8px;

  padding: 6px 12px;

  font-size: 12px;

  cursor: pointer;

  color: var(--text);

  flex-shrink: 0;

}



.commit-records__body {

  padding: 12px 14px 14px;

}



.commit-records__hint {

  margin: 0 0 8px;

  font-size: 12px;

  color: var(--muted);

}



.commit-records__scroll {

  max-height: min(280px, 36vh);

  overflow: auto;

  overflow-x: auto;

  scrollbar-color: var(--scrollbar-thumb, #888) transparent;

  scrollbar-width: thin;

  border-radius: 10px;

}



.commit-records__loading,

.commit-records__empty {

  margin: 20px 12px;

  text-align: center;

  color: var(--muted);

  font-size: 13px;

}



.chevron {

  display: inline-block;

  transform: rotate(0deg);

  transition: transform 0.15s ease;

  color: var(--muted);

  font-size: 20px;

  line-height: 1;

  flex-shrink: 0;

}



.chevron.open {

  transform: rotate(90deg);

}

</style>
