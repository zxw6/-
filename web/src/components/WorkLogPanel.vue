<!-- 入口按钮样式参考 Uiverse.io by vinodjangid07；看板布局自建 -->
<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { fetchWorkMemos, createWorkMemo, updateWorkMemo, deleteWorkMemo } from '../api.js';
import { useI18n } from '../i18n/index.js';

const { t } = useI18n();

const BOARD_COLUMNS = [
  { id: 'todo', class: 'col-todo' },
  { id: 'doing', class: 'col-doing' },
  { id: 'done', class: 'col-done' },
];

const open = ref(false);
const memos = ref([]);
const loadingList = ref(false);
const selectedId = ref(null);
const editTitle = ref('');
const editContent = ref('');
const editBoard = ref('todo');
const dirty = ref(false);
const saving = ref(false);
const dragMemoId = ref(null);
const dropColumn = ref(null);
let saveTimer;

function columnTitle(id) {
  if (id === 'todo') return t('workLogColTodo');
  if (id === 'doing') return t('workLogColDoing');
  return t('workLogColDone');
}

function memoCardTitle(m) {
  const title = String(m.title ?? '').trim();
  if (title) return title;
  const line = String(m.content ?? '').trim().split(/\r?\n/)[0];
  return line || t('workLogUntitled');
}

function contentPreview(text) {
  const s = String(text ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return t('workLogEmptyPreview');
  return s.length > 72 ? `${s.slice(0, 72)}…` : s;
}

function formatCardTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const memosByColumn = computed(() => {
  const map = { todo: [], doing: [], done: [] };
  for (const m of memos.value) {
    const key = m.boardStatus === 'doing' || m.boardStatus === 'done' ? m.boardStatus : 'todo';
    map[key].push(m);
  }
  return map;
});

const statusText = computed(() => {
  if (!selectedId.value) return '';
  if (saving.value) return t('workLogSaving');
  if (dirty.value) return t('workLogUnsaved');
  return t('workLogSaved');
});

function patchMemoInList(memo) {
  const idx = memos.value.findIndex((x) => x.id === memo.id);
  if (idx >= 0) memos.value[idx] = memo;
  else memos.value = [memo, ...memos.value];
}

async function loadList() {
  loadingList.value = true;
  try {
    const res = await fetchWorkMemos();
    if (res.ok) memos.value = res.items ?? [];
  } finally {
    loadingList.value = false;
  }
}

function applySelection(id) {
  const m = memos.value.find((x) => x.id === id);
  if (!m) {
    selectedId.value = null;
    editTitle.value = '';
    editContent.value = '';
    editBoard.value = 'todo';
    dirty.value = false;
    return;
  }
  selectedId.value = id;
  editTitle.value = m.title ?? '';
  editContent.value = m.content ?? '';
  editBoard.value = m.boardStatus ?? 'todo';
  dirty.value = false;
}

function selectMemo(id, saveFirst = true) {
  if (saveFirst && dirty.value && selectedId.value) {
    void persist().then(() => applySelection(id));
    return;
  }
  applySelection(id);
}

async function persist() {
  const id = selectedId.value;
  if (!id || !dirty.value) return;
  saving.value = true;
  try {
    const res = await updateWorkMemo(id, {
      title: editTitle.value,
      content: editContent.value,
      boardStatus: editBoard.value,
    });
    if (res.ok && res.memo) {
      dirty.value = false;
      patchMemoInList(res.memo);
    }
  } finally {
    saving.value = false;
  }
}

async function persistBoardOnly(id, boardStatus) {
  const res = await updateWorkMemo(id, { boardStatus });
  if (res.ok && res.memo) patchMemoInList(res.memo);
}

function onEdit() {
  dirty.value = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void persist(), 800);
}

function onBoardChange() {
  dirty.value = true;
  void persist();
}

async function openDialog() {
  open.value = true;
  selectedId.value = null;
  await loadList();
}

function closeDialog() {
  clearTimeout(saveTimer);
  if (dirty.value) void persist();
  open.value = false;
  selectedId.value = null;
}

async function addMemo(boardStatus = 'todo') {
  if (dirty.value && selectedId.value) await persist();
  const res = await createWorkMemo({ title: t('workLogNewTitle'), content: '', boardStatus });
  if (res.ok && res.memo) {
    memos.value = [res.memo, ...memos.value];
    applySelection(res.memo.id);
    dirty.value = false;
  }
}

async function removeMemo(id) {
  if (!window.confirm(t('workLogDeleteConfirm'))) return;
  if (selectedId.value === id) {
    clearTimeout(saveTimer);
    selectedId.value = null;
    dirty.value = false;
  } else if (dirty.value && selectedId.value) {
    await persist();
  }
  const res = await deleteWorkMemo(id);
  if (res.ok) {
    memos.value = memos.value.filter((m) => m.id !== id);
    if (selectedId.value === id) applySelection(null);
  }
}

function onBackdrop(e) {
  if (e.target === e.currentTarget) closeDialog();
}

function onDragStart(id, e) {
  dragMemoId.value = id;
  e.dataTransfer?.setData('text/plain', String(id));
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd() {
  dragMemoId.value = null;
  dropColumn.value = null;
}

function onColumnDragOver(colId, e) {
  e.preventDefault();
  dropColumn.value = colId;
}

function onColumnDragLeave(colId) {
  if (dropColumn.value === colId) dropColumn.value = null;
}

async function onColumnDrop(colId, e) {
  e.preventDefault();
  dropColumn.value = null;
  const raw = e.dataTransfer?.getData('text/plain');
  const id = Number(raw || dragMemoId.value);
  dragMemoId.value = null;
  if (!Number.isFinite(id)) return;
  const m = memos.value.find((x) => x.id === id);
  if (!m || m.boardStatus === colId) return;
  if (selectedId.value === id) editBoard.value = colId;
  await persistBoardOnly(id, colId);
}

watch(open, (v) => {
  document.body.style.overflow = v ? 'hidden' : '';
});

onUnmounted(() => {
  clearTimeout(saveTimer);
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="work-log-launch">
    <button type="button" class="memo-go-btn" :title="t('workLogOpenHint')" @click="openDialog">
      <span class="memo-go-btn__text">{{ t('workLogOpenBtn') }}</span>
      <span class="memo-go-btn__icon">
        <svg width="16" height="19" viewBox="0 0 16 19" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <circle cx="1.61321" cy="1.61321" r="1.5" fill="black" />
          <circle cx="5.73583" cy="1.61321" r="1.5" fill="black" />
          <circle cx="5.73583" cy="5.5566" r="1.5" fill="black" />
          <circle cx="9.85851" cy="5.5566" r="1.5" fill="black" />
          <circle cx="9.85851" cy="9.5" r="1.5" fill="black" />
          <circle cx="13.9811" cy="9.5" r="1.5" fill="black" />
          <circle cx="5.73583" cy="13.4434" r="1.5" fill="black" />
          <circle cx="9.85851" cy="13.4434" r="1.5" fill="black" />
          <circle cx="1.61321" cy="17.3868" r="1.5" fill="black" />
          <circle cx="5.73583" cy="17.3868" r="1.5" fill="black" />
        </svg>
      </span>
    </button>

    <Teleport to="body">
      <div v-if="open" class="memo-backdrop" @click="onBackdrop">
        <div
          class="memo-dialog kanban-dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="t('workLogDialogTitle')"
          @click.stop
        >
          <header class="memo-dialog__head">
            <div class="memo-dialog__head-left">
              <h2 class="memo-dialog__title">{{ t('workLogDialogTitle') }}</h2>
              <span class="memo-dialog__badge">{{ t('workLogKanbanHint') }}</span>
            </div>
            <div class="memo-dialog__head-actions">
              <button type="button" class="memo-head-btn" @click="addMemo('todo')">+ {{ t('workLogNew') }}</button>
              <button type="button" class="memo-dialog__close" :aria-label="t('close')" @click="closeDialog">✕</button>
            </div>
          </header>

          <p v-if="loadingList" class="kanban-loading">{{ t('loading') }}</p>
          <div v-else class="kanban-board">
            <section
              v-for="col in BOARD_COLUMNS"
              :key="col.id"
              class="kanban-col"
              :class="[col.class, { 'kanban-col--hover': dropColumn === col.id }]"
              @dragover="onColumnDragOver(col.id, $event)"
              @dragleave="onColumnDragLeave(col.id)"
              @drop="onColumnDrop(col.id, $event)"
            >
              <header class="kanban-col__head">
                <span class="kanban-col__title">{{ columnTitle(col.id) }}</span>
                <span class="kanban-col__count">{{ memosByColumn[col.id].length }}</span>
                <button type="button" class="kanban-col__add" :title="t('workLogNew')" @click="addMemo(col.id)">+</button>
              </header>
              <ul class="kanban-col__list">
                <li v-for="m in memosByColumn[col.id]" :key="m.id">
                  <article
                    class="kanban-card"
                    :class="{ active: m.id === selectedId, dragging: dragMemoId === m.id }"
                    draggable="true"
                    @dragstart="onDragStart(m.id, $event)"
                    @dragend="onDragEnd"
                    @click="selectMemo(m.id)"
                  >
                    <div class="kanban-card__top">
                      <h3 class="kanban-card__title">{{ memoCardTitle(m) }}</h3>
                      <button
                        type="button"
                        class="kanban-card__del"
                        :title="t('workLogDelete')"
                        @click.stop="removeMemo(m.id)"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m1 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7h12Z"
                            stroke="currentColor"
                            stroke-width="1.6"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                    <p class="kanban-card__preview">{{ contentPreview(m.content) }}</p>
                    <time class="kanban-card__time">{{ formatCardTime(m.updatedAt) }}</time>
                  </article>
                </li>
              </ul>
            </section>
          </div>

          <footer v-if="selectedId" class="kanban-editor">
            <div class="kanban-editor__bar">
              <input
                v-model="editTitle"
                class="kanban-editor__title"
                type="text"
                :placeholder="t('workLogTitlePlaceholder')"
                @input="onEdit"
                @blur="persist"
              />
              <label class="kanban-editor__stage">
                <span class="kanban-editor__stage-label">{{ t('workLogStage') }}</span>
                <select v-model="editBoard" class="kanban-editor__select" @change="onBoardChange">
                  <option value="todo">{{ t('workLogColTodo') }}</option>
                  <option value="doing">{{ t('workLogColDoing') }}</option>
                  <option value="done">{{ t('workLogColDone') }}</option>
                </select>
              </label>
              <span v-if="statusText" class="kanban-editor__status" :class="{ ok: !dirty && !saving }">{{ statusText }}</span>
              <button type="button" class="kanban-editor__delete" @click="removeMemo(selectedId)">{{ t('workLogDelete') }}</button>
              <button type="button" class="kanban-editor__collapse" :title="t('close')" @click="selectedId = null">▾</button>
            </div>
            <textarea
              v-model="editContent"
              class="kanban-editor__body"
              rows="4"
              :placeholder="t('workLogPlaceholder')"
              spellcheck="false"
              @input="onEdit"
              @blur="persist"
            />
          </footer>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.work-log-launch {
  flex-shrink: 0;
}

.memo-go-btn {
  display: flex;
  width: 170px;
  height: fit-content;
  background-color: #1d2129;
  border-radius: 40px;
  box-shadow: 0 5px 10px #bebebe;
  justify-content: space-between;
  align-items: center;
  border: none;
  cursor: pointer;
  padding: 0;
  font-family: inherit;
}

:global([data-theme='dark']) .memo-go-btn {
  box-shadow: 0 5px 14px rgba(0, 0, 0, 0.45);
}

.memo-go-btn__text {
  width: calc(170px - 45px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 0.95em;
  letter-spacing: 0.6px;
  padding: 10px 0 10px 12px;
}

.memo-go-btn__icon {
  width: 45px;
  height: 45px;
  background-color: #f59aff;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 3px solid #1d2129;
  flex-shrink: 0;
}

.memo-go-btn:hover .memo-go-btn__icon svg {
  animation: memo-arrow 1s linear infinite;
}

@keyframes memo-arrow {
  0% {
    opacity: 0;
    margin-left: 0;
  }
  100% {
    opacity: 1;
    margin-left: 10px;
  }
}

.memo-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: rgba(12, 17, 26, 0.62);
  backdrop-filter: blur(6px);
}

.kanban-dialog {
  width: min(960px, 100%);
  max-height: min(90vh, 640px);
  display: flex;
  flex-direction: column;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: linear-gradient(165deg, var(--panel) 0%, var(--bg) 100%);
  box-shadow: 0 28px 60px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.memo-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border);
}

.memo-dialog__head-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.memo-dialog__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}

.memo-dialog__badge {
  font-size: 11px;
  color: var(--muted);
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--bg);
  border: 1px solid var(--border);
  white-space: nowrap;
}

.memo-dialog__head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.memo-head-btn {
  border: none;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: #1d2129;
  background: #f59aff;
}

.memo-dialog__close {
  border: none;
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
}

.kanban-loading {
  margin: 24px;
  text-align: center;
  color: var(--muted);
}

.kanban-board {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  padding: 14px 16px;
  flex: 1;
  min-height: 320px;
  overflow: auto;
}

.kanban-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
  border-radius: 14px;
  padding: 10px;
  background: rgba(255, 255, 255, 0.45);
  border: 1px dashed transparent;
  transition: border-color 0.15s, background 0.15s;
}

:global([data-theme='dark']) .kanban-col {
  background: rgba(0, 0, 0, 0.2);
}

.kanban-col--hover {
  border-color: #f59aff;
  background: rgba(245, 154, 255, 0.08);
}

.col-todo .kanban-col__head {
  --col-accent: #f59aff;
}
.col-doing .kanban-col__head {
  --col-accent: #539bf5;
}
.col-done .kanban-col__head {
  --col-accent: #3fb950;
}

.kanban-col__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 2px solid var(--col-accent, #f59aff);
}

.kanban-col__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  flex: 1;
}

.kanban-col__count {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted);
  min-width: 1.5em;
  text-align: center;
  padding: 2px 6px;
  border-radius: 6px;
  background: var(--panel);
}

.kanban-col__add {
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 8px;
  background: var(--col-accent, #f59aff);
  color: #1d2129;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  line-height: 1;
}

.kanban-col__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  overflow-y: auto;
  max-height: 360px;
}

.kanban-card {
  border-radius: 12px;
  padding: 10px 10px 8px;
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  cursor: grab;
  transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s;
}

.kanban-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.1);
}

.kanban-card.active {
  border-color: #f59aff;
  box-shadow: 0 0 0 2px rgba(245, 154, 255, 0.35);
}

.kanban-card.dragging {
  opacity: 0.55;
  cursor: grabbing;
}

.kanban-card__top {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.kanban-card__title {
  margin: 0;
  flex: 1;
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  line-height: 1.35;
  word-break: break-word;
}

.kanban-card__del {
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 2px;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s, color 0.12s, background 0.12s;
}

.kanban-card:hover .kanban-card__del,
.kanban-card__del:focus-visible {
  opacity: 1;
}

.kanban-card__del:hover {
  color: #cf222e;
  background: rgba(207, 34, 46, 0.1);
}

.kanban-card__preview {
  margin: 6px 0 4px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kanban-card__time {
  font-size: 10px;
  color: var(--muted);
  opacity: 0.85;
}

.kanban-editor {
  border-top: 1px solid var(--border);
  padding: 12px 16px 14px;
  background: var(--panel);
}

.kanban-editor__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  margin-bottom: 8px;
}

.kanban-editor__title {
  flex: 1 1 200px;
  min-width: 120px;
  border: none;
  border-bottom: 2px solid var(--border);
  background: transparent;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  padding: 4px 2px;
  outline: none;
}

.kanban-editor__title:focus {
  border-color: #f59aff;
}

.kanban-editor__stage {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--muted);
}

.kanban-editor__select {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  background: var(--bg);
  color: var(--text);
}

.kanban-editor__status {
  font-size: 10px;
  color: var(--muted);
}

.kanban-editor__status.ok {
  color: #3a9d5c;
}

.kanban-editor__delete {
  margin-left: auto;
  border: 1px solid rgba(207, 34, 46, 0.35);
  background: transparent;
  color: #cf222e;
  border-radius: 8px;
  padding: 5px 10px;
  font-size: 11px;
  cursor: pointer;
}

.kanban-editor__collapse {
  border: 1px solid var(--border);
  background: var(--bg);
  border-radius: 8px;
  padding: 5px 10px;
  cursor: pointer;
  color: var(--muted);
}

.kanban-editor__body {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  font: inherit;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text);
  background: var(--bg);
  resize: vertical;
  min-height: 88px;
  outline: none;
}

.kanban-editor__body:focus {
  border-color: #f59aff;
}

@media (max-width: 760px) {
  .kanban-board {
    grid-template-columns: 1fr;
  }
}
</style>