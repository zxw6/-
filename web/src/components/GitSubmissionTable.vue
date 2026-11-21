<script setup>
import { computed } from 'vue';
import { useI18n } from '../i18n/index.js';

const props = defineProps({
  items: { type: Array, default: () => [] },
  compact: { type: Boolean, default: false },
});

const { t } = useI18n();

const rows = computed(() => props.items ?? []);

function formatTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString(undefined, { hour12: false });
}

function actionLabel(action) {
  const map = {
    merge: t('gitActionMerge'),
    commit: t('gitActionCommit'),
    push: t('gitActionPush'),
    deploy: t('gitActionDeploy'),
  };
  return map[action] ?? action;
}

function mergeSummary(row) {
  if (row.action !== 'merge') return '—';
  const from = row.mergeFrom || '—';
  const into = row.mergeInto || row.branch || '—';
  return t('gitMergeSummary', { from, into });
}

function accountLabel(row) {
  return row.gitAccount || row.authorEmail || row.authorName || '—';
}
</script>

<template>
  <div class="git-table-wrap" :class="{ 'git-table-wrap--compact': compact }">
    <table class="git-table">
      <thead>
        <tr>
          <th class="col-graph" aria-hidden="true" />
          <th class="col-msg">{{ t('gitColMessage') }}</th>
          <th class="col-user">{{ t('gitColUser') }}</th>
          <th class="col-merge">{{ t('gitColMerge') }}</th>
          <th class="col-time">{{ t('gitColTime') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!rows.length">
          <td colspan="5" class="git-empty">{{ t('gitEmpty') }}</td>
        </tr>
        <tr v-for="(row, i) in rows" :key="row.id ?? row.commitHash ?? i" class="git-row">
          <td class="col-graph">
            <span class="git-node" :class="row.action" />
            <span v-if="i < rows.length - 1" class="git-line" />
          </td>
          <td class="col-msg">
            <span class="git-badge" :class="`act-${row.action}`">{{ actionLabel(row.action) }}</span>
            <span class="git-repo">{{ row.repoLabel || row.repoKey }}</span>
            <p class="git-msg">{{ row.message }}</p>
            <span v-if="row.shortHash" class="git-hash">{{ row.shortHash }}</span>
          </td>
          <td class="col-user">
            <span class="git-user">{{ row.authorName || '—' }}</span>
            <span class="git-account">{{ accountLabel(row) }}</span>
          </td>
          <td class="col-merge">{{ mergeSummary(row) }}</td>
          <td class="col-time">{{ formatTime(row.committedAt) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.git-table-wrap {
  overflow: auto;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: #1e1f22;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

:global([data-theme='light']) .git-table-wrap {
  background: var(--panel);
  box-shadow: none;
}

:global([data-theme='light']) .git-table-wrap .git-table {
  color: var(--text);
}

:global([data-theme='light']) .git-table-wrap .git-table thead th {
  background: var(--surface-muted);
  color: var(--muted);
  border-bottom-color: var(--border);
}

:global([data-theme='light']) .git-table-wrap .git-row {
  border-bottom-color: var(--border);
}

:global([data-theme='light']) .git-table-wrap .git-row:hover {
  background: var(--surface-muted);
}

:global([data-theme='light']) .git-table-wrap .git-msg,
:global([data-theme='light']) .git-table-wrap .git-user {
  color: var(--text);
}

:global([data-theme='light']) .git-table-wrap .git-repo,
:global([data-theme='light']) .git-table-wrap .git-account,
:global([data-theme='light']) .git-table-wrap .git-hash,
:global([data-theme='light']) .git-table-wrap .col-time,
:global([data-theme='light']) .git-table-wrap .col-merge {
  color: var(--muted);
}

:global([data-theme='light']) .git-table-wrap .git-node {
  border-color: var(--panel);
}

:global([data-theme='light']) .git-table-wrap .git-empty {
  color: var(--muted);
}

.git-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  color: #e6edf3;
}

.git-table thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  text-align: left;
  padding: 10px 12px;
  font-weight: 600;
  font-size: 11px;
  color: #9da7b3;
  background: #2b2d30;
  border-bottom: 1px solid #3d4148;
}

.git-row {
  border-bottom: 1px solid #3d4148;
}

.git-row:hover {
  background: rgba(255, 255, 255, 0.04);
}

.git-row td {
  padding: 10px 12px;
  vertical-align: top;
}

.col-graph {
  width: 28px;
  position: relative;
  padding-left: 14px !important;
}

.git-node {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #539bf5;
  border: 2px solid #1e1f22;
  position: relative;
  z-index: 1;
}

.git-node.merge {
  background: #a371f7;
}
.git-node.deploy {
  background: #3fb950;
}
.git-node.push {
  background: #f0883e;
}

.git-line {
  position: absolute;
  left: 18px;
  top: 22px;
  bottom: -10px;
  width: 2px;
  background: linear-gradient(#539bf5, #a371f7);
  opacity: 0.65;
}

.col-msg {
  min-width: 200px;
}

.git-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 6px;
  margin-right: 6px;
  vertical-align: middle;
}

.act-merge {
  background: rgba(163, 113, 247, 0.25);
  color: #d2a8ff;
}
.act-commit {
  background: rgba(83, 155, 245, 0.2);
  color: #79c0ff;
}
.act-deploy {
  background: rgba(63, 185, 80, 0.2);
  color: #7ee787;
}

.git-repo {
  font-size: 10px;
  color: #8b949e;
}

.git-msg {
  margin: 6px 0 4px;
  font-size: 13px;
  line-height: 1.45;
  color: #e6edf3;
  word-break: break-word;
}

.git-hash {
  font-family: ui-monospace, monospace;
  font-size: 10px;
  color: #8b949e;
}

.col-user {
  min-width: 120px;
}

.git-user {
  display: block;
  font-weight: 600;
  color: #e6edf3;
}

.git-account {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: #8b949e;
  word-break: break-all;
}

.col-merge {
  font-size: 11px;
  color: #c9d1d9;
  min-width: 100px;
}

.col-time {
  white-space: nowrap;
  font-size: 11px;
  color: #9da7b3;
  min-width: 130px;
}

.git-empty {
  text-align: center;
  padding: 28px !important;
  color: #8b949e;
}

.git-table-wrap--compact .git-table {
  font-size: 11px;
}

.git-table-wrap--compact .git-msg {
  font-size: 12px;
}

.git-table-wrap--in-scroll {
  border: none;
  border-radius: 0;
}
</style>