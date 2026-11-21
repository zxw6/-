<script setup>
import { onMounted, onUnmounted, ref, watch, computed } from 'vue';
import ContributionHeatmap from './components/ContributionHeatmap.vue';
import ActivityFeed from './components/ActivityFeed.vue';
import ProfileSidebar from './components/ProfileSidebar.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import ThemeToggle from './components/ThemeToggle.vue';
import GitHubLauncher from './components/GitHubLauncher.vue';
import CommitRecordSection from './components/CommitRecordSection.vue';
import WorkLogPanel from './components/WorkLogPanel.vue';
import ClawModeToggle from './components/ClawModeToggle.vue';
import DeployView from './views/DeployView.vue';
import { applyTheme, readCachedTheme } from './theme.js';
import {
  fetchRepos,
  fetchSettings,
  fetchYearStats,
  fetchDay,
  fetchTimeline,
  connectActivitySocket,
  saveProfileSettings,
  saveMonitorSettings,
  avatarUrl,
} from './api.js';
import { setLocale, useI18n } from './i18n/index.js';

const { t } = useI18n();

const profile = ref({ username: '', nickname: '', bio: '' });
const monitor = ref({ repositories: [], snapshotIntervalSeconds: 120 });
const repos = ref([]);
const year = ref(new Date().getFullYear());
const years = [2026, 2025, 2024, 2023];
const byDay = ref({});
const selectedDay = ref(null);
const dayDetail = ref(null);
const timeline = ref([]);
const live = ref(false);
const loadingDay = ref(false);
const settingsOpen = ref(false);
const avatarSrc = ref('');
const theme = ref('dark');
const deployMode = ref(false);
const MODE_KEY = 'code-workbench-app-mode';
const gitRefreshKey = ref(0);
let ws;

const onGitRefresh = () => {
  gitRefreshKey.value += 1;
};

const repoCount = computed(() => repos.value.length);

const loadSettings = async () => {
  const data = await fetchSettings();
  profile.value = data.profile ?? profile.value;
  monitor.value = data.monitor ?? monitor.value;
  if (profile.value.locale) setLocale(profile.value.locale);
  const th = profile.value.theme || readCachedTheme() || 'dark';
  theme.value = th === 'light' ? 'light' : 'dark';
  applyTheme(theme.value);
  try {
    const probe = await fetch(avatarUrl(false), { method: 'HEAD' });
    avatarSrc.value = probe.ok ? avatarUrl() : '';
  } catch {
    avatarSrc.value = '';
  }
};

const refreshRepos = async () => {
  const meta = await fetchRepos();
  repos.value = meta.repos ?? [];
};

const reloadYear = async () => {
  const stats = await fetchYearStats(year.value);
  byDay.value = stats.byDay ?? {};
};

const selectDay = async (date) => {
  selectedDay.value = date;
  loadingDay.value = true;
  try {
    dayDetail.value = { date, ...(await fetchDay(date)) };
  } finally {
    loadingDay.value = false;
  }
};

const onPickDay = async (date) => {
  const y = Number(date.slice(0, 4));
  if (Number.isFinite(y) && y !== year.value) year.value = y;
  await selectDay(date);
};

const refreshTimeline = async () => {
  timeline.value = (await fetchTimeline()).items ?? [];
};

const openSettings = () => {
  settingsOpen.value = true;
};

const onThemeChange = (mode) => {
  theme.value = mode === 'light' ? 'light' : 'dark';
  applyTheme(theme.value);
  void saveProfileSettings({
    username: profile.value.username,
    nickname: profile.value.nickname,
    bio: profile.value.bio,
    locale: profile.value.locale,
    city: profile.value.city,
    theme: theme.value,
  });
};

const onWeatherLocation = (body) => {
  void onSaveProfile({
    username: profile.value.username,
    nickname: profile.value.nickname,
    bio: profile.value.bio,
    locale: profile.value.locale,
    city: body.city,
    weatherLat: body.weatherLat,
    weatherLon: body.weatherLon,
    weatherAutoLocate: profile.value.weatherAutoLocate !== false,
    theme: theme.value,
    keepOpen: true,
  });
};

const onSaveProfile = async (body) => {
  const keepOpen = body.keepOpen === true;
  const payload = { ...body };
  delete payload.keepOpen;
  const res = await saveProfileSettings(payload);
  if (res.ok) {
    profile.value = res.profile;
    if (res.profile?.locale) setLocale(res.profile.locale);
    if (res.profile?.theme) {
      theme.value = res.profile.theme === 'light' ? 'light' : 'dark';
      applyTheme(theme.value);
    }
    if (payload.avatarDataUrl) avatarSrc.value = avatarUrl();
    if (!keepOpen) settingsOpen.value = false;
  }
};

const onSaveMonitor = async (body) => {
  const res = await saveMonitorSettings(body);
  if (res.ok) {
    monitor.value = res.monitor;
    await refreshRepos();
    settingsOpen.value = false;
  }
};

const onDeployModeChange = (v) => {
  deployMode.value = v;
  try {
    localStorage.setItem(MODE_KEY, v ? 'deploy' : 'workbench');
  } catch {
    /* ignore */
  }
};

onMounted(async () => {
  try {
    deployMode.value = localStorage.getItem(MODE_KEY) === 'deploy';
  } catch {
    deployMode.value = false;
  }
  await loadSettings();
  await refreshRepos();
  await reloadYear();
  await refreshTimeline();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  await selectDay(todayKey);

  ws = connectActivitySocket((msg) => {
    if (msg.channel === 'activity') {
      live.value = true;
      const p = msg.payload;
      const d = new Date(p.ts);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (key.startsWith(String(year.value))) {
        byDay.value = { ...byDay.value, [key]: (byDay.value[key] ?? 0) + 1 };
      }
      if (selectedDay.value === key) void selectDay(key);
      void refreshTimeline();
    }
    if (msg.channel === 'monitoring') void refreshRepos();
  });
});

onUnmounted(() => ws?.close());
watch(year, () => void reloadYear());
</script>

<template>
  <div class="page" :class="{ 'page--deploy': deployMode }">
    <header class="top-bar">
      <div class="top-bar__row">
        <div class="top-bar__start">
          <ClawModeToggle
            class="claw-compact"
            :model-value="deployMode"
            @update:model-value="onDeployModeChange"
          />
          <span class="brand">{{ deployMode ? t('navDeploy') : t('brand') }}</span>
        </div>
        <div class="top-actions">
          <GitHubLauncher class="top-actions__item" @refresh="onGitRefresh" />
          <ThemeToggle class="top-actions__item" :model-value="theme" @update:model-value="onThemeChange" />
          <WorkLogPanel class="top-actions__item top-actions__memo" />
          <!-- 样式参考 Uiverse.io by augustin_4687 -->
          <button type="button" class="btn-settings top-actions__item" :title="t('settings')" @click="openSettings">
          <div class="btn-settings__face">
            <span>
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M8 4.754a3.254 3.254 0 1 0 0 6.508 3.254 3.254 0 0 0 0-6.508ZM1.654 7.946a.655.655 0 0 1-.65-.643l-.04-1.36a.654.654 0 0 1 .56-.696 6.562 6.562 0 0 0 1.045-2.31.654.654 0 0 1 .867-.382l1.198.618a6.49 6.49 0 0 0 1.73-.993l.016-1.336a.654.654 0 0 1 .686-.629l1.37.071a.654.654 0 0 1 .619.686l-.025 1.336a6.49 6.49 0 0 0 1.73.993l1.198-.618a.654.654 0 0 1 .867.382c.315.74.615 1.506.888 2.31a.654.654 0 0 1 .56.696l-.04 1.36a.655.655 0 0 1-.643.65 6.554 6.554 0 0 0-1.253 2.007.654.654 0 0 1-.382.867l-1.198.618a6.49 6.49 0 0 0-.993 1.73l.071 1.37a.654.654 0 0 1-.629.686l-1.336-.025a6.49 6.49 0 0 0-1.73.993l-.618 1.198a.654.654 0 0 1-.867.382 6.562 6.562 0 0 0-2.31 1.045.654.654 0 0 1-.696.56l-1.36-.04a.655.655 0 0 1-.65-.643 6.554 6.554 0 0 0-2.007-1.253.654.654 0 0 1-.867-.382l-.618-1.198a6.49 6.49 0 0 0-1.73-.993l-1.336.016a.654.654 0 0 1-.686-.619l.071-1.37a6.49 6.49 0 0 0-.993-1.73l-1.198-.618a.654.654 0 0 1-.382-.867 6.562 6.562 0 0 0-1.045-2.31.654.654 0 0 1-.56-.696l.04-1.36a.655.655 0 0 1 .643-.65 6.554 6.554 0 0 0 2.007-1.253.654.654 0 0 1 .382-.867l.618-1.198a6.49 6.49 0 0 0 .993-1.73l-.071-1.37a.654.654 0 0 1 .629-.686l1.336.025a6.49 6.49 0 0 0 1.73-.993l.618 1.198a.654.654 0 0 1 .867-.382c.74.315 1.506.615 2.31.888Z"
                />
              </svg>
              {{ t('settings') }}
            </span>
          </div>
        </button>
        </div>
      </div>
    </header>

    <DeployView v-if="deployMode" @deploy-done="onGitRefresh" />

    <div v-if="!deployMode" class="layout">
      <ProfileSidebar
        :profile="profile"
        :live="live"
        :repo-count="repoCount"
        :avatar-src="avatarSrc"
        @edit-profile="settingsOpen = true"
        @weather-location="onWeatherLocation"
      />
      <main>
        <ContributionHeatmap
          v-model:year="year"
          :years="years"
          :by-day="byDay"
          :selected="selectedDay"
          @select-day="selectDay"
        />
        <ActivityFeed
          :selected-day="selectedDay"
          :items="timeline"
          :day-detail="dayDetail"
          :loading="loadingDay"
          :repo-labels="repos"
          @pick-day="onPickDay"
        />
        <CommitRecordSection :refresh-key="gitRefreshKey" />
      </main>
    </div>

    <SettingsDialog
      :open="settingsOpen"
      :profile="profile"
      :monitor="monitor"
      @close="settingsOpen = false"
      @save-profile="onSaveProfile"
      @save-monitor="onSaveMonitor"
    />
  </div>
</template>

<style scoped>
.page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}
.page--deploy {
  max-width: none;
  padding: 16px 20px 20px;
  background: var(--bg);
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
}
.page--deploy :deep(.hub) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.top-bar {
  margin-bottom: 20px;
}
.top-bar__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
}
.top-bar__start {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.top-bar__start :deep(.claw-compact) {
  font-size: 3.4px;
  flex-shrink: 0;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.25));
}
.top-bar__start :deep(.claw-compact .claw-toggle-track) {
  box-shadow:
    inset 0 0.4em 1em rgba(0, 0, 0, 0.9),
    inset 0 -0.1em 0.3em rgba(255, 255, 255, 0.08),
    0 0.4em 1em rgba(0, 0, 0, 0.45);
}
.top-actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 14px;
  flex: 1;
  min-width: 0;
  padding: 0;
  min-height: 48px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}
.top-actions__item {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  margin: 0;
}
.top-actions :deep(.theme-toggle-button) {
  font-size: 12px;
  display: flex;
  align-items: center;
}
.top-actions :deep(.git-launch) {
  flex-direction: row;
  align-items: center;
  gap: 6px;
}
.top-actions :deep(.git-launch-btn) {
  margin: 0;
}
.top-actions :deep(.work-log-launch) {
  display: flex;
  align-items: center;
}
.top-actions :deep(.memo-go-btn) {
  margin: 0;
}
.top-actions .btn-settings {
  transform: none;
  align-self: center;
}
.top-actions .btn-settings:hover {
  transform: translate(2px, 2px);
}
.brand {
  font-size: 14px;
  color: var(--muted);
}
.btn-settings {
  --stone-50: #fafaf9;
  --stone-800: #292524;
  --yellow-400: #facc15;
  font-size: 0.875rem;
  cursor: pointer;
  position: relative;
  font-family: 'Rubik', system-ui, sans-serif;
  font-weight: 700;
  line-height: 1;
  padding: 1px;
  border: none;
  transform: translate(-4px, -4px);
  outline: 2px solid transparent;
  outline-offset: 5px;
  border-radius: 9999px;
  background-color: var(--stone-800);
  color: var(--stone-800);
  transition:
    transform 150ms ease,
    box-shadow 150ms ease;
  text-align: center;
  box-shadow:
    0.5px 0.5px 0 0 var(--stone-800),
    1px 1px 0 0 var(--stone-800),
    1.5px 1.5px 0 0 var(--stone-800),
    2px 2px 0 0 var(--stone-800),
    2.5px 2.5px 0 0 var(--stone-800),
    3px 3px 0 0 var(--stone-800),
    0 0 0 2px var(--stone-50),
    0.5px 0.5px 0 2px var(--stone-50),
    1px 1px 0 2px var(--stone-50),
    1.5px 1.5px 0 2px var(--stone-50),
    2px 2px 0 2px var(--stone-50),
    2.5px 2.5px 0 2px var(--stone-50),
    3px 3px 0 2px var(--stone-50),
    3.5px 3.5px 0 2px var(--stone-50),
    4px 4px 0 2px var(--stone-50);
}
.btn-settings:hover {
  transform: translate(0, 0);
  box-shadow: 0 0 0 2px var(--stone-50);
}
.btn-settings:active,
.btn-settings:focus-visible {
  outline-color: var(--yellow-400);
}
.btn-settings:focus-visible {
  outline-style: dashed;
}
.btn-settings__face {
  position: relative;
  pointer-events: none;
  background-color: var(--yellow-400);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 9999px;
}
.btn-settings__face::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 9999px;
  opacity: 0.5;
  background-image:
    radial-gradient(rgb(255 255 255 / 80%) 20%, transparent 20%),
    radial-gradient(rgb(255 255 255 / 100%) 20%, transparent 20%);
  background-position:
    0 0,
    4px 4px;
  background-size: 8px 8px;
  mix-blend-mode: hard-light;
  animation: btn-settings-dots 0.5s infinite linear;
}
.btn-settings__face > span {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.55rem 1rem;
  gap: 0.35rem;
  filter: drop-shadow(0 -1px 0 rgba(255, 255, 255, 0.25));
}
.btn-settings:active .btn-settings__face > span {
  transform: translateY(2px);
}
@keyframes btn-settings-dots {
  0% {
    background-position:
      0 0,
      4px 4px;
  }
  100% {
    background-position:
      8px 0,
      12px 4px;
  }
}
.layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
  align-items: start;
}
main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
@media (max-width: 1012px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>