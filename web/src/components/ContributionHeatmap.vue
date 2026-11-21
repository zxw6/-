<script setup>
import { computed } from 'vue';
import { useI18n } from '../i18n/index.js';

const props = defineProps({
  year: { type: Number, required: true },
  years: { type: Array, default: () => [] },
  byDay: { type: Object, default: () => ({}) },
  selected: { type: String, default: null },
});

const emit = defineEmits(['select-day', 'update:year']);

const { t, monthLabel } = useI18n();

const levelFor = (count) => {
  if (!count) return 0;
  if (count < 5) return 1;
  if (count < 15) return 2;
  if (count < 40) return 3;
  return 4;
};

const dayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const weeks = computed(() => {
  const y = props.year;
  let cursor = new Date(y, 0, 1);
  while (cursor.getDay() !== 0) {
    cursor.setDate(cursor.getDate() - 1);
  }

  const cols = [];
  const lastDay = new Date(y, 11, 31);

  while (cursor <= lastDay || cursor.getFullYear() === y) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(cursor);
      cellDate.setDate(cursor.getDate() + d);
      const inYear = cellDate.getFullYear() === y;
      const key = inYear ? dayKey(cellDate) : null;
      const count = key ? props.byDay[key] ?? 0 : 0;
      week.push({
        key,
        date: cellDate,
        inYear,
        count,
        level: inYear ? levelFor(count) : -1,
      });
    }
    cols.push(week);
    cursor.setDate(cursor.getDate() + 7);
    if (cursor.getFullYear() > y && cursor.getMonth() > 0) break;
    if (cursor.getFullYear() > y + 1) break;
  }
  return cols;
});

/** 每周列宽 = 格子 11px + 列间距 3px（与 .week-grid 一致） */
const WEEK_COL_STEP = 14;

/** 每月只渲染一个标签，绝对定位，避免中文月份在窄格内重叠 */
const monthPositions = computed(() => {
  const out = [];
  let lastMonth = -1;
  weeks.value.forEach((week, wi) => {
    for (const cell of week) {
      if (!cell.inYear) continue;
      const m = cell.date.getMonth();
      if (cell.date.getDate() <= 7 && m !== lastMonth) {
        lastMonth = m;
        out.push({ month: m, left: wi * WEEK_COL_STEP, label: monthLabel(m) });
        break;
      }
    }
  });
  return out;
});

const monthTrackWidth = computed(() => Math.max(0, weeks.value.length * WEEK_COL_STEP - 3));

const total = computed(() =>
  Object.entries(props.byDay)
    .filter(([k]) => k.startsWith(String(props.year)))
    .reduce((s, [, v]) => s + v, 0),
);

const titleText = computed(() => t('contributionsTitle', { n: total.value, year: props.year }));

const titleFor = (cell) => {
  if (!cell.key) return '';
  const part =
    cell.count === 1 ? t('contribOne') : t('contribMany', { n: cell.count });
  return `${part}${t('onDate', { date: cell.key })}`;
};
</script>

<template>
  <div class="contrib-graph">
    <div class="graph-card">
      <div class="graph-header">
        <h2 class="graph-title">{{ titleText }}</h2>
        <details class="contrib-settings">
          <summary>{{ t('contribSettings') }}</summary>
          <div class="settings-panel">
            <p>{{ t('contribSettingsHint') }}</p>
          </div>
        </details>
      </div>

      <div class="graph-shell">
        <div class="graph-scroll">
          <div class="month-row" aria-hidden="true">
            <span class="month-spacer" />
            <div class="month-track" :style="{ width: `${monthTrackWidth}px` }">
              <span
                v-for="(m, i) in monthPositions"
                :key="`${m.month}-${i}`"
                class="month-tag"
                :style="{ left: `${m.left}px` }"
              >
                {{ m.label }}
              </span>
            </div>
          </div>
          <div class="grid-row">
            <ul class="weekday-axis" aria-hidden="true">
              <li class="wday">{{ t('mon') }}</li>
              <li class="wday wday--hidden" />
              <li class="wday">{{ t('wed') }}</li>
              <li class="wday wday--hidden" />
              <li class="wday">{{ t('fri') }}</li>
              <li class="wday wday--hidden" />
              <li class="wday wday--hidden" />
            </ul>
            <div class="week-grid">
              <div v-for="(week, wi) in weeks" :key="wi" class="week-col">
                <button
                  v-for="(cell, di) in week"
                  :key="`${wi}-${di}`"
                  type="button"
                  class="day"
                  :class="[
                    `day--L${cell.level < 0 ? 0 : cell.level}`,
                    { 'day--out': !cell.inYear, 'day--on': cell.key && cell.key === selected },
                  ]"
                  :disabled="!cell.inYear || !cell.key"
                  :aria-label="cell.key ? titleFor(cell) : undefined"
                  :title="cell.key ? t('cellTitle', { date: cell.key, count: cell.count }) : ''"
                  @click="cell.key && emit('select-day', cell.key)"
                />
              </div>
            </div>
          </div>
        </div>

        <nav class="year-list" :aria-label="t('yearSelect')">
          <button
            v-for="y in years"
            :key="y"
            type="button"
            class="year-pill"
            :class="{ 'year-pill--active': y === year }"
            @click="emit('update:year', y)"
          >
            {{ y }}
          </button>
        </nav>
      </div>

      <div class="contrib-footer">
        <div class="contrib-legend">
          <span class="legend-label">{{ t('less') }}</span>
          <span class="day day--L0 legend-swatch" />
          <span class="day day--L1 legend-swatch" />
          <span class="day day--L2 legend-swatch" />
          <span class="day day--L3 legend-swatch" />
          <span class="day day--L4 legend-swatch" />
          <span class="legend-label">{{ t('more') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.contrib-graph {
  width: 100%;
}

.graph-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 16px 16px 12px;
}

.graph-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.graph-title {
  margin: 0;
  font-size: 16px;
  font-weight: 400;
  color: var(--text);
  line-height: 1.5;
}

.contrib-settings {
  position: relative;
  font-size: 12px;
  color: var(--text-secondary);
}

.contrib-settings summary {
  cursor: pointer;
  list-style: none;
  color: var(--text-secondary);
}

.contrib-settings summary::-webkit-details-marker {
  display: none;
}

.contrib-settings summary::after {
  content: ' ▾';
  font-size: 10px;
}

.settings-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 2;
  min-width: 220px;
  padding: 12px;
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 12px;
  color: var(--muted);
  box-shadow: var(--shadow-popover);
}

.graph-shell {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.graph-scroll {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  padding-bottom: 4px;
}

.month-row {
  display: flex;
  gap: 3px;
  margin-bottom: 4px;
  height: 15px;
}

.month-spacer {
  flex: 0 0 27px;
}

.month-track {
  position: relative;
  height: 16px;
  flex: 0 0 auto;
}

.month-tag {
  position: absolute;
  top: 0;
  font-size: 11px;
  color: var(--text-tertiary);
  line-height: 16px;
  white-space: nowrap;
  pointer-events: none;
}

.grid-row {
  display: flex;
  gap: 3px;
}

.weekday-axis {
  list-style: none;
  margin: 0;
  padding: 0;
  width: 27px;
  flex-shrink: 0;
}

.wday {
  height: 11px;
  font-size: 9px;
  line-height: 11px;
  color: var(--text-tertiary);
  margin: 0 0 3px;
  text-align: left;
}

.wday--hidden {
  visibility: hidden;
}

.week-grid {
  display: flex;
  gap: 3px;
}

.week-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.day {
  width: 11px;
  height: 11px;
  border-radius: 2px;
  border: none;
  padding: 0;
  display: block;
  box-sizing: border-box;
  background-color: var(--heat-empty);
  outline: 1px solid var(--heat-outline);
  outline-offset: -1px;
}

button.day:not(:disabled) {
  cursor: pointer;
}

button.day:not(:disabled):hover {
  outline: 1px solid rgba(88, 166, 255, 0.45);
  outline-offset: -1px;
}

.day--on {
  outline: 1px solid #58a6ff !important;
  outline-offset: -1px;
}

.day--out {
  visibility: hidden;
  pointer-events: none;
}

.day--L0 {
  background-color: var(--heat-empty);
}
.day--L1 {
  background-color: #0e4429;
}
.day--L2 {
  background-color: #006d32;
}
.day--L3 {
  background-color: #26a641;
}
.day--L4 {
  background-color: #39d353;
}

.year-list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  flex-shrink: 0;
  padding-top: 22px;
}

.year-pill {
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.25;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
}

.year-pill:hover {
  color: var(--link);
}

.year-pill--active {
  background-color: var(--year-active-bg);
  color: #ffffff;
  font-weight: 600;
  outline: none;
}

.contrib-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  margin-top: 14px;
}

.contrib-legend {
  display: flex;
  align-items: center;
  gap: 3px;
}

.legend-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0 4px;
}

.legend-swatch {
  cursor: default;
  pointer-events: none;
}
</style>