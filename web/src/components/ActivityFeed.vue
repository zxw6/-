<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from '../i18n/index.js';
import SliderLoader from './SliderLoader.vue';

const props = defineProps({
  items: { type: Array, default: () => [] },
  selectedDay: { type: String, default: null },
  dayDetail: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  repoLabels: { type: Array, default: () => [] },
});

const emit = defineEmits(['pick-day']);

const { t } = useI18n();

const dayOpen = ref(true);
const recentOpen = ref(false);
const snapOpenMap = ref({});

const repoFilter = ref('');
const typeFilter = ref('all');
const pathQuery = ref('');
const snapshotView = ref('latest');

watch(
  () => props.selectedDay,
  () => {
    repoFilter.value = '';
    typeFilter.value = 'all';
    pathQuery.value = '';
    snapOpenMap.value = {};
  },
);

const repoName = (key) => props.repoLabels.find((r) => r.key === key)?.label ?? key;

const repoOptions = computed(() => {
  if (!props.dayDetail) return [];
  const keys = new Set();
  for (const e of props.dayDetail.fileEvents ?? []) keys.add(e.repo_key);
  for (const s of props.dayDetail.snapshots ?? []) keys.add(s.repo_key);
  return [...keys].sort();
});

const matchPath = (text, q) => {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return String(text).toLowerCase().includes(needle);
};

const filteredFileEvents = computed(() => {
  const list = props.dayDetail?.fileEvents ?? [];
  return list.filter((e) => {
    if (repoFilter.value && e.repo_key !== repoFilter.value) return false;
    if (typeFilter.value === 'snapshot') return false;
    return matchPath(e.rel_path, pathQuery.value);
  });
});

const filteredSnapshots = computed(() => {
  let list = [...(props.dayDetail?.snapshots ?? [])];
  if (snapshotView.value === 'latest') {
    const byRepo = new Map();
    for (const s of list) {
      const prev = byRepo.get(s.repo_key);
      if (!prev || s.ts > prev.ts) byRepo.set(s.repo_key, s);
    }
    list = [...byRepo.values()].sort((a, b) => b.ts - a.ts);
  } else {
    list.sort((a, b) => b.ts - a.ts);
  }
  return list.filter((s) => {
    if (repoFilter.value && s.repo_key !== repoFilter.value) return false;
    if (typeFilter.value === 'file') return false;
    const files = parseFiles(s);
    if (pathQuery.value.trim()) {
      return files.some((f) => matchPath(f.path, pathQuery.value));
    }
    return true;
  });
});

const hasDayContent = computed(
  () => filteredFileEvents.value.length > 0 || filteredSnapshots.value.length > 0,
);

const filteredRecent = computed(() => {
  return props.items.filter((item) => {
    if (repoFilter.value && item.repo_key !== repoFilter.value) return false;
    if (typeFilter.value === 'file' && item.type !== 'file') return false;
    if (typeFilter.value === 'snapshot' && item.type !== 'snapshot') return false;
    if (item.type === 'file') return matchPath(item.detail, pathQuery.value);
    if (pathQuery.value.trim() && item.type === 'snapshot') {
      try {
        const files = JSON.parse(item.extra);
        return files.some((f) => matchPath(f.path, pathQuery.value));
      } catch {
        return false;
      }
    }
    return true;
  });
});

const formatTime = (ts) => {
  const d = new Date(ts);
  return d.toLocaleString(undefined, { hour12: false });
};

const kindLabel = (kind) => {
  const map = {
    add: t('kindAdd'),
    change: t('kindChange'),
    unlink: t('kindUnlink'),
    wip: t('kindWip'),
  };
  return map[kind] ?? kind;
};

const parseFiles = (s) => {
  try {
    return JSON.parse(s.files_json);
  } catch {
    return [];
  }
};

const snapshotFiles = (s) => {
  const files = parseFiles(s);
  const q = pathQuery.value.trim();
  if (!q) return files;
  return files.filter((f) => matchPath(f.path, q));
};

const toggleSnap = (id) => {
  snapOpenMap.value[id] = !snapOpenMap.value[id];
};

const isSnapOpen = (id) => snapOpenMap.value[id] === true;

const onDateInput = (e) => {
  const v = e.target.value;
  if (v) emit('pick-day', v);
};
</script>

<template>
  <section class="feed">
    <div class="feed-head feed-head--loader-only">
      <div class="feed-loader">
        <SliderLoader :aria-label="t('activityLoader')" />
      </div>
    </div>

    <div class="filters">
      <label class="filter-item">
        <span>{{ t('filterRepo') }}</span>
        <select v-model="repoFilter" class="filter-select">
          <option value="">{{ t('filterRepoAll') }}</option>
          <option v-for="k in repoOptions" :key="k" :value="k">{{ repoName(k) }} ({{ k }})</option>
        </select>
      </label>
      <label class="filter-item">
        <span>{{ t('filterType') }}</span>
        <select v-model="typeFilter" class="filter-select">
          <option value="all">{{ t('filterTypeAll') }}</option>
          <option value="file">{{ t('filterTypeFile') }}</option>
          <option value="snapshot">{{ t('filterTypeSnapshot') }}</option>
        </select>
      </label>
      <label class="filter-item filter-item--grow">
        <span>{{ t('filterPath') }}</span>
        <input
          v-model="pathQuery"
          type="search"
          class="filter-input"
          :placeholder="t('filterPathPlaceholder')"
        />
      </label>
      <label class="filter-item">
        <span>{{ t('snapshotView') }}</span>
        <select v-model="snapshotView" class="filter-select">
          <option value="latest">{{ t('snapshotLatest') }}</option>
          <option value="all">{{ t('snapshotAll') }}</option>
        </select>
      </label>
    </div>

    <div class="collapsible">
      <div class="day-toolbar">
        <button type="button" class="chevron-btn" :aria-expanded="dayOpen" @click="dayOpen = !dayOpen">
          <span class="chevron" :class="{ open: dayOpen }">›</span>
        </button>
        <label class="date-field">
          <span class="sr-only">{{ t('pickDate') }}</span>
          <input type="date" class="date-input" :value="selectedDay ?? ''" @change="onDateInput" />
        </label>
      </div>
      <div v-show="dayOpen" class="collapse-body scroll-panel">
        <div v-if="loading" class="muted empty loading-hint">{{ t('loading') }}</div>
        <div v-else-if="dayDetail && dayDetail.date === selectedDay" class="day-body">
          <div
            v-if="!dayDetail.fileEvents?.length && !dayDetail.snapshots?.length"
            class="muted empty"
          >
            {{ t('emptyDay') }}
          </div>
          <div v-else-if="!hasDayContent" class="muted empty">{{ t('noFilterMatch') }}</div>

          <ul v-if="filteredFileEvents.length" class="list list--with-summary">
            <li v-for="e in filteredFileEvents" :key="'f' + e.id" class="list-row">
              <time>{{ formatTime(e.ts) }}</time>
              <span class="repo">{{ repoName(e.repo_key) }}</span>
              <span class="kind">{{ kindLabel(e.kind) }}</span>
              <code class="path">{{ e.rel_path }}</code>
              <span class="summary" :title="e.summary || ''">
                {{ e.summary || t('summaryEmpty') }}
              </span>
            </li>
          </ul>

          <div v-for="s in filteredSnapshots" :key="'s' + s.id" class="snapshot">
            <button type="button" class="collapse-head snap-head" @click="toggleSnap(s.id)">
              <span class="chevron" :class="{ open: isSnapOpen(s.id) }">›</span>
              <time>{{ formatTime(s.ts) }}</time>
              <span class="repo">{{ repoName(s.repo_key) }}</span>
              <span v-if="pathQuery.trim()">
                {{ t('matchedFiles', { n: snapshotFiles(s).length, total: s.file_count }) }}
              </span>
              <span v-else>{{ t('uncommittedFiles', { n: s.file_count }) }}</span>
            </button>
            <ul v-show="isSnapOpen(s.id)" class="files scroll-inner">
              <li v-for="f in snapshotFiles(s)" :key="f.path" class="file-line">
                <code>{{ f.path }}</code>
                <span class="summary" v-if="f.summary">{{ f.summary }}</span>
                <span class="muted" v-else-if="f.insertions || f.deletions"
                  >+{{ f.insertions }} / -{{ f.deletions }}</span
                >
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div class="collapsible">
      <button type="button" class="collapse-head" @click="recentOpen = !recentOpen">
        <span class="chevron" :class="{ open: recentOpen }">›</span>
        <span>{{ t('recentActivity') }}</span>
      </button>
      <div v-show="recentOpen" class="collapse-body scroll-panel scroll-panel--tall">
        <p v-if="!filteredRecent.length" class="muted empty">{{ t('noFilterMatch') }}</p>
        <ul v-else class="list list--with-summary">
          <li v-for="item in filteredRecent" :key="item.type + item.id" class="list-row">
            <time>{{ formatTime(item.ts) }}</time>
            <span class="repo">{{ repoName(item.repo_key) }}</span>
            <template v-if="item.type === 'file'">
              <span class="kind">{{ kindLabel(item.kind) }}</span>
              <code class="path">{{ item.detail }}</code>
              <span class="summary" :title="item.extra || ''">
                {{ item.extra || t('summaryEmpty') }}
              </span>
            </template>
            <template v-else>
              <span class="kind">{{ t('kindWip') }}</span>
              <code class="path">{{ t('uncommittedFiles', { n: item.detail }) }}</code>
              <span class="summary">{{ t('summaryEmpty') }}</span>
            </template>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script>
export default { name: 'ActivityFeed' };
</script>

<style scoped>
.feed {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 0;
  overflow: hidden;
}
.feed-head {
  border-bottom: 1px solid var(--border);
  padding: 16px 16px 12px;
}
.feed-title {
  margin: 0 0 12px;
  font-weight: 400;
  font-size: 14px;
  color: var(--text);
  text-align: center;
}
.feed-loader {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 72px;
}
.loading-hint {
  padding-top: 4px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-inset);
}
.filter-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
  min-width: 120px;
}
.filter-item--grow {
  flex: 1;
  min-width: 180px;
}
.filter-select,
.filter-input {
  background: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 8px;
  font-size: 13px;
}
.collapsible {
  border-bottom: 1px solid var(--border);
}
.collapsible:last-child {
  border-bottom: none;
}
.day-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}
.chevron-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}
.date-field {
  flex: 1;
  display: flex;
  align-items: center;
}
.date-input {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  background: var(--surface-subtle);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  color-scheme: light dark;
  font-family: inherit;
  max-width: 180px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
.collapse-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
}
.collapse-head:hover {
  background: var(--surface-muted);
}
.chevron {
  display: inline-block;
  transform: rotate(0deg);
  transition: transform 0.15s ease;
  color: var(--muted);
  font-size: 18px;
  line-height: 1;
}
.chevron.open {
  transform: rotate(90deg);
}
.collapse-body {
  padding: 0 16px 16px;
}
.scroll-panel {
  max-height: 320px;
  overflow-y: auto;
  scrollbar-color: var(--scrollbar-thumb) transparent;
  scrollbar-width: thin;
}
.scroll-panel--tall {
  max-height: 280px;
}
.list-row {
  display: grid;
  grid-template-columns: 138px 88px 52px minmax(80px, 1fr) minmax(120px, 1fr);
  gap: 8px;
  align-items: baseline;
  padding: 6px 0;
  border-bottom: 1px solid var(--divider);
  font-size: 13px;
}
.list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.summary {
  font-size: 12px;
  color: var(--summary);
  word-break: break-word;
}
time {
  color: var(--muted);
}
.repo {
  color: var(--link);
  font-size: 12px;
}
.kind {
  color: var(--accent-2);
  font-size: 12px;
}
code {
  font-size: 12px;
  word-break: break-all;
}
.muted {
  color: var(--muted);
  font-size: 13px;
}
.empty {
  padding: 8px 0;
}
.snapshot {
  margin-top: 8px;
  border: 1px solid var(--divider);
  border-radius: 6px;
  overflow: hidden;
}
.snap-head {
  font-weight: 400;
  font-size: 13px;
  padding: 10px 12px;
  width: 100%;
}
.files {
  margin: 0;
  padding: 8px 12px 12px 28px;
  font-size: 12px;
  max-height: 220px;
  overflow-y: auto;
}
.file-line {
  margin: 6px 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.file-line .summary {
  color: var(--muted);
}
</style>