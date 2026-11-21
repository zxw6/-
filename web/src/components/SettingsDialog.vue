<script setup>

import { reactive, ref, watch } from 'vue';

import { useI18n, setLocale } from '../i18n/index.js';

import { pickFolder, openFolder, syncGithubProfile } from '../api.js';



const props = defineProps({

  open: { type: Boolean, default: false },

  profile: { type: Object, required: true },

  monitor: { type: Object, required: true },

});



const emit = defineEmits(['close', 'save-profile', 'save-monitor']);



const { t } = useI18n();



const tab = ref('profile');
const githubSyncing = ref(false);
const githubSyncMsg = ref('');

const formProfile = reactive({

  username: '',

  nickname: '',

  bio: '',

  avatarDataUrl: '',

  locale: 'zh-CN',

  city: '',

  weatherAutoLocate: true,

});

const avatarPreview = ref('');

const formMonitor = reactive({

  snapshotIntervalSeconds: 120,

  repositories: [],

});



watch(

  () => props.open,

  (v) => {

    if (!v) return;

    formProfile.username = props.profile.username ?? '';

    formProfile.nickname = props.profile.nickname ?? '';

    formProfile.bio = props.profile.bio ?? '';

    formProfile.locale = props.profile.locale ?? 'zh-CN';

    formProfile.city = props.profile.city ?? '';

    formProfile.weatherAutoLocate = props.profile.weatherAutoLocate !== false;

    formProfile.avatarDataUrl = '';

    avatarPreview.value = '';

    formMonitor.snapshotIntervalSeconds = props.monitor.snapshotIntervalSeconds ?? 120;

    formMonitor.repositories = (props.monitor.repositories ?? []).map((r) => ({ ...r }));

  },

);



const onFile = (e) => {

  const file = e.target.files?.[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {

    formProfile.avatarDataUrl = reader.result;

    avatarPreview.value = reader.result;

  };

  reader.readAsDataURL(file);

};



const addRepo = () => {

  formMonitor.repositories.push({

    key: `proj-${formMonitor.repositories.length + 1}`,

    label: '',

    path: '',

    note: '',

  });

};



const removeRepo = (i) => {

  formMonitor.repositories.splice(i, 1);

};



const pickingIndex = ref(-1);



const pickPath = async (i) => {

  if (pickingIndex.value >= 0) return;

  pickingIndex.value = i;

  try {

    const res = await pickFolder(formMonitor.repositories[i]?.path ?? '');

    if (res.ok && res.path) {

      formMonitor.repositories[i].path = res.path;

      const parts = res.path.replace(/\\/g, '/').split('/').filter(Boolean);

      const leaf = parts[parts.length - 1] ?? '';

      if (!formMonitor.repositories[i].label && leaf) {

        formMonitor.repositories[i].label = leaf;

      }

      if (!formMonitor.repositories[i].key && leaf) {

        formMonitor.repositories[i].key = leaf.replace(/\W+/g, '-').slice(0, 16) || `proj-${i + 1}`;

      }

    }

  } finally {

    pickingIndex.value = -1;

  }

};



const openPath = async (folderPath) => {

  if (!folderPath?.trim()) return;

  await openFolder(folderPath.trim());

};



const onLocaleChange = () => {

  setLocale(formProfile.locale);

};



const onCityBlur = () => {
  if (formProfile.weatherAutoLocate) return;
  const city = String(formProfile.city ?? '').trim();
  if (!city || city === String(props.profile.city ?? '').trim()) return;
  setLocale(formProfile.locale);
  emit('save-profile', {
    username: formProfile.username,
    nickname: formProfile.nickname,
    bio: formProfile.bio,
    locale: formProfile.locale,
    city,
    weatherAutoLocate: false,
    keepOpen: true,
  });
};

const onWeatherAutoChange = () => {
  emit('save-profile', {
    username: formProfile.username,
    nickname: formProfile.nickname,
    bio: formProfile.bio,
    locale: formProfile.locale,
    city: formProfile.city,
    weatherAutoLocate: formProfile.weatherAutoLocate === true,
    keepOpen: true,
  });
};

async function syncGithub() {
  githubSyncMsg.value = '';
  githubSyncing.value = true;
  try {
    const res = await syncGithubProfile();
    if (res.ok) {
      githubSyncMsg.value = res.pushed === false ? res.message || t('githubSyncOk') : t('githubSyncOk');
      if (res.profileUrl) {
        githubSyncMsg.value += ` · ${res.profileUrl}`;
      }
    } else {
      githubSyncMsg.value = `${t('githubSyncFail')}: ${res.error || ''}`;
    }
  } catch (e) {
    githubSyncMsg.value = `${t('githubSyncFail')}: ${e.message || e}`;
  } finally {
    githubSyncing.value = false;
  }
}

const save = () => {

  if (tab.value === 'profile' || tab.value === 'language') {

    setLocale(formProfile.locale);

    emit('save-profile', { ...formProfile });

  } else {

    emit('save-monitor', {

      snapshotIntervalSeconds: Number(formMonitor.snapshotIntervalSeconds) || 120,

      repositories: formMonitor.repositories.filter((r) => r.key && r.path),

    });

  }

};

</script>



<template>

  <!-- 样式参考 Uiverse.io by mamyapro123 -->

  <div v-if="open" class="backdrop" @click.self="emit('close')">

    <div class="doodle-wrapper settings-doodle" role="dialog" :aria-label="t('settings')">

      <div class="doodle-card-scene settings-scene">

        <svg

          class="doodle-svg doodle-star"

          viewBox="0 0 24 24"

          fill="#ffd166"

          stroke="var(--ink)"

          stroke-width="1.5"

          aria-hidden="true"

        >

          <polygon

            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"

          />

        </svg>

        <svg

          class="doodle-svg doodle-sparkle"

          viewBox="0 0 24 24"

          fill="#06d6a0"

          stroke="var(--ink)"

          stroke-width="1.5"

          aria-hidden="true"

        >

          <path d="M12 2 Q12 12 22 12 Q12 12 12 22 Q12 12 2 12 Q12 12 12 2 Z" />

        </svg>

        <svg

          class="doodle-svg doodle-swirl"

          viewBox="0 0 24 24"

          fill="none"

          stroke="var(--ink)"

          stroke-width="1.5"

          stroke-linecap="round"

          aria-hidden="true"

        >

          <path d="M3 12 C 3 5 10 5 16 5 C 20 5 21 9 18 12 C 15 15 10 13 12 9 C 14 5 22 9 21 16" />

        </svg>



        <div class="doodle-card-front settings-card">

          <header class="settings-head">

            <h2 id="settings-title" class="doodle-title">{{ t('settings') }}</h2>

            <button type="button" class="doodle-close" :aria-label="t('close')" @click="emit('close')">✕</button>

          </header>



          <nav class="doodle-tabs" :aria-label="t('settings')">

            <button

              type="button"

              class="doodle-tab"

              :class="{ active: tab === 'profile' }"

              @click="tab = 'profile'"

            >

              {{ t('tabProfile') }}

            </button>

            <button

              type="button"

              class="doodle-tab"

              :class="{ active: tab === 'monitor' }"

              @click="tab = 'monitor'"

            >

              {{ t('tabMonitor') }}

            </button>

            <button

              type="button"

              class="doodle-tab"

              :class="{ active: tab === 'language' }"

              @click="tab = 'language'"

            >

              {{ t('tabLanguage') }}

            </button>

          </nav>



          <div v-show="tab === 'profile'" class="doodle-form panel">

            <div class="avatar-row">

              <img v-if="avatarPreview" :src="avatarPreview" class="thumb" alt="" />

              <div v-else class="thumb thumb--empty">{{ t('avatarPlaceholder') }}</div>

              <label class="doodle-btn doodle-btn--sm file-btn">

                {{ t('uploadAvatar') }}

                <input type="file" accept="image/*" hidden @change="onFile" />

              </label>

            </div>

            <label class="field">

              <span>{{ t('username') }}</span>

              <input v-model="formProfile.username" class="doodle-input" type="text" />

            </label>

            <label class="field">

              <span>{{ t('displayName') }}</span>

              <input v-model="formProfile.nickname" class="doodle-input" type="text" />

            </label>

            <label class="field">

              <span>{{ t('bio') }}</span>

              <textarea v-model="formProfile.bio" class="doodle-input doodle-textarea" rows="3" />

            </label>

            <label class="field field--row">

              <span>{{ t('weatherAutoLocate') }}</span>

              <input v-model="formProfile.weatherAutoLocate" type="checkbox" @change="onWeatherAutoChange" />

            </label>

            <p class="hint">{{ t('weatherAutoLocateHint') }}</p>

            <label class="field">

              <span>{{ t('weatherCity') }}</span>

              <input

                v-model="formProfile.city"

                class="doodle-input"

                type="text"

                :placeholder="t('weatherCityHint')"
                :disabled="formProfile.weatherAutoLocate"
                @blur="onCityBlur"
              />

            </label>

            <p v-if="!formProfile.weatherAutoLocate" class="hint">{{ t('weatherCityAutoSave') }}</p>

            <div class="github-sync-block">
              <p class="hint">{{ t('githubSyncProfileHint') }}</p>
              <button
                type="button"
                class="doodle-btn doodle-btn--sm"
                :disabled="githubSyncing"
                @click="syncGithub"
              >
                {{ githubSyncing ? t('githubSyncing') : t('githubSyncProfile') }}
              </button>
              <p v-if="githubSyncMsg" class="hint github-sync-msg">{{ githubSyncMsg }}</p>
            </div>

          </div>



          <div v-show="tab === 'language'" class="doodle-form panel">

            <label class="field">

              <span>{{ t('langLabel') }}</span>

              <select v-model="formProfile.locale" class="doodle-input doodle-select" @change="onLocaleChange">

                <option value="zh-CN">{{ t('langZh') }}</option>

                <option value="en-US">{{ t('langEn') }}</option>

              </select>

            </label>

            <p class="hint">{{ t('langHint') }}</p>

          </div>



          <div v-show="tab === 'monitor'" class="doodle-form panel panel--monitor">

            <label class="field field--row">

              <span>{{ t('snapshotInterval') }}</span>

              <input

                v-model.number="formMonitor.snapshotIntervalSeconds"

                class="doodle-input doodle-input--short"

                type="number"

                min="30"

                step="30"

              />

            </label>

            <div class="repo-toolbar">

              <span>{{ t('repositories') }}</span>

              <button type="button" class="doodle-link" @click="addRepo">{{ t('addPath') }}</button>

            </div>

            <div class="repo-list">

              <div v-for="(r, i) in formMonitor.repositories" :key="i" class="repo-row">

                <input v-model="r.key" class="doodle-input" :placeholder="t('placeholderKey')" />

                <input v-model="r.label" class="doodle-input" :placeholder="t('placeholderLabel')" />

                <div class="path-cell">

                  <input

                    v-model="r.path"

                    type="text"

                    class="doodle-input path-input"

                    :placeholder="t('placeholderPath')"

                    :title="t('pickFolder')"

                    readonly

                    @click="pickPath(i)"

                  />

                  <button

                    type="button"

                    class="doodle-icon-btn folder-btn"

                    :title="r.path ? t('openFolder') : t('pickFolder')"

                    :disabled="pickingIndex === i"

                    @click="r.path ? openPath(r.path) : pickPath(i)"

                  >

                    {{ r.path ? '↗' : '📁' }}

                  </button>

                </div>

                <button type="button" class="doodle-icon-btn" @click="removeRepo(i)">−</button>

              </div>

            </div>

            <p class="hint">{{ t('pathPickHint') }}</p>

            <p class="hint">{{ t('monitorHint') }}</p>

            <p v-if="pickingIndex >= 0" class="hint picking">{{ t('pickingFolder') }}</p>

          </div>



          <footer class="settings-footer">

            <button type="button" class="doodle-btn doodle-btn-alt" @click="emit('close')">{{ t('cancel') }}</button>

            <button type="button" class="doodle-btn" @click="save">{{ t('saveChanges') }}</button>

          </footer>

        </div>

      </div>

    </div>

  </div>

</template>



<style scoped>

/* Uiverse doodle palette — 设置弹窗固定手绘浅色风格 */

.settings-doodle {

  --ink: #323232;

  --paper-front: #fff9e6;

  --bg-color: #ffffff;

  --primary-btn: #ff6b6b;

  --primary-btn-hover: #ff5252;

  --secondary-btn: #4ecdc4;

  --secondary-btn-hover: #3bbfb6;

  --input-focus: #2d8cf0;

  --border-width: 2px;

  --shadow-offset: 4px;

  --sketch-radius-1: 8px 24px 8px 24px / 24px 8px 24px 8px;

  --sketch-radius-2: 24px 8px 24px 8px / 8px 24px 8px 24px;

  --sketch-radius-btn: 16px 5px 16px 5px / 5px 16px 5px 16px;

  font-family: 'Comic Sans MS', 'Chalkboard SE', 'Marker Felt', 'Gochi Hand', sans-serif;

  width: 100%;

  max-width: 640px;

  box-sizing: border-box;

}



.backdrop {

  position: fixed;

  inset: 0;

  background: rgba(50, 50, 50, 0.55);

  z-index: 100;

  display: flex;

  align-items: flex-start;

  justify-content: center;

  padding: 32px 16px;

  overflow-y: auto;

}



.settings-scene {

  position: relative;

  width: 100%;

  z-index: 2;

}



.doodle-svg {

  position: absolute;

  z-index: -1;

  pointer-events: none;

}

.doodle-star {

  top: -20px;

  left: -20px;

  width: 48px;

  height: 48px;

  animation: float-star 4s ease-in-out infinite;

}

.doodle-sparkle {

  bottom: 40px;

  right: -18px;

  width: 40px;

  height: 40px;

  animation: float-sparkle 4s ease-in-out infinite 1s;

}

.doodle-swirl {

  top: 80px;

  right: -22px;

  width: 32px;

  height: 32px;

  animation: float-swirl 4s ease-in-out infinite 2s;

}



@keyframes float-star {

  0%,

  100% {

    transform: translateY(0) rotate(-15deg);

  }

  50% {

    transform: translateY(-8px) rotate(-10deg);

  }

}

@keyframes float-sparkle {

  0%,

  100% {

    transform: translateY(0) rotate(10deg);

  }

  50% {

    transform: translateY(-8px) rotate(15deg);

  }

}

@keyframes float-swirl {

  0%,

  100% {

    transform: translateY(0) rotate(0deg);

  }

  50% {

    transform: translateY(-8px) rotate(5deg);

  }

}



.settings-card {

  position: relative;

  width: 100%;

  border: var(--border-width) solid var(--ink);

  border-radius: var(--sketch-radius-1);

  box-shadow: var(--shadow-offset) var(--shadow-offset) 0 var(--ink);

  background-color: var(--paper-front);

  background-image: repeating-linear-gradient(

    transparent,

    transparent 28px,

    rgba(0, 0, 0, 0.06) 28px,

    rgba(0, 0, 0, 0.06) 30px

  );

  background-position: 0 15px;

  padding: 20px 22px 18px;

  box-sizing: border-box;

}



.settings-head {

  display: flex;

  align-items: flex-start;

  justify-content: space-between;

  gap: 12px;

  margin-bottom: 8px;

}



.doodle-title {

  font-size: 26px;

  font-weight: 900;

  color: var(--ink);

  margin: 0;

  text-transform: uppercase;

  letter-spacing: 1px;

  transform: rotate(-2deg);

  text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.1);

}



.settings-scene:hover .doodle-title {

  animation: doodle-wiggle 0.5s ease-in-out;

}



@keyframes doodle-wiggle {

  0%,

  100% {

    transform: rotate(-2deg);

  }

  25% {

    transform: rotate(2deg);

  }

  50% {

    transform: rotate(-3deg);

  }

  75% {

    transform: rotate(1deg);

  }

}



.doodle-close {

  flex-shrink: 0;

  width: 36px;

  height: 36px;

  font-size: 16px;

  font-weight: 900;

  color: var(--ink);

  background: var(--bg-color);

  border: var(--border-width) solid var(--ink);

  border-radius: 50%;

  box-shadow: 2px 2px 0 var(--ink);

  cursor: pointer;

  transition: all 0.15s ease;

}

.doodle-close:hover {

  transform: translateY(-2px);

  box-shadow: 3px 3px 0 var(--ink);

}

.doodle-close:active {

  transform: translate(2px, 2px);

  box-shadow: 0 0 0 var(--ink);

}



.doodle-tabs {

  display: flex;

  flex-wrap: wrap;

  gap: 8px;

  margin-bottom: 16px;

}



.doodle-tab {

  font-family: inherit;

  font-size: 14px;

  font-weight: 800;

  color: var(--ink);

  padding: 6px 14px;

  background: var(--bg-color);

  border: var(--border-width) solid var(--ink);

  border-radius: var(--sketch-radius-btn);

  box-shadow: 2px 2px 0 var(--ink);

  cursor: pointer;

  opacity: 0.55;

  transition: all 0.15s ease;

}

.doodle-tab:hover {

  opacity: 0.85;

  transform: translateY(-1px);

}

.doodle-tab.active {

  opacity: 1;

  background: #ffe66d;

  box-shadow: 3px 3px 0 var(--ink);

  transform: rotate(-1deg);

}



.doodle-form {

  display: flex;

  flex-direction: column;

  gap: 12px;

  width: 100%;

}



.field {

  display: flex;

  flex-direction: column;

  gap: 6px;

  font-size: 14px;

  font-weight: 700;

  color: var(--ink);

}

.field--row {

  flex-direction: row;

  align-items: center;

  justify-content: space-between;

  gap: 12px;

}



.doodle-input {

  width: 100%;

  min-height: 40px;

  padding: 6px 12px;

  box-sizing: border-box;

  font-family: inherit;

  font-size: 15px;

  font-weight: 600;

  color: var(--ink);

  background-color: var(--bg-color);

  border: var(--border-width) solid var(--ink);

  border-radius: var(--sketch-radius-1);

  box-shadow: 3px 3px 0 var(--ink);

  outline: none;

  transition: all 0.2s ease;

}

.doodle-input--short {

  width: 120px;

  flex-shrink: 0;

}

.doodle-textarea {

  min-height: 72px;

  resize: vertical;

}

.doodle-select {

  cursor: pointer;

}

.doodle-input::placeholder {

  color: #666;

  opacity: 0.8;

}

.doodle-input:hover {

  transform: translateY(-2px);

  box-shadow: 4px 4px 0 var(--ink);

}

.doodle-input:focus,

.doodle-input:focus-visible {

  border-color: var(--input-focus);

  border-radius: var(--sketch-radius-2);

  background-color: #fffdf5;

}



.avatar-row {

  display: flex;

  align-items: center;

  gap: 16px;

  flex-wrap: wrap;

}

.thumb {

  width: 80px;

  height: 80px;

  border-radius: 50%;

  object-fit: cover;

  border: var(--border-width) solid var(--ink);

  box-shadow: 2px 2px 0 var(--ink);

}

.thumb--empty {

  display: flex;

  align-items: center;

  justify-content: center;

  background: #fff;

  font-size: 12px;

  color: #666;

}



.doodle-btn {

  display: inline-flex;

  align-items: center;

  justify-content: center;

  min-width: 120px;

  height: 40px;

  padding: 0 16px;

  font-family: inherit;

  font-size: 16px;

  font-weight: 900;

  letter-spacing: 0.5px;

  color: var(--ink);

  background-color: var(--primary-btn);

  border: var(--border-width) solid var(--ink);

  border-radius: var(--sketch-radius-btn);

  box-shadow: 4px 4px 0 var(--ink);

  cursor: pointer;

  transition: all 0.15s ease;

  transform: rotate(-1deg);

}

.doodle-btn--sm {

  min-width: auto;

  height: 36px;

  font-size: 14px;

  margin: 0;

}

.doodle-btn-alt {

  background-color: var(--secondary-btn);

  transform: rotate(1deg);

}

.doodle-btn:hover {

  background-color: var(--primary-btn-hover);

  transform: translateY(-2px) rotate(-2deg);

  box-shadow: 5px 5px 0 var(--ink);

}

.doodle-btn-alt:hover {

  background-color: var(--secondary-btn-hover);

  transform: translateY(-2px) rotate(2deg);

}

.doodle-btn:active {

  transform: translate(3px, 3px) rotate(0deg);

  box-shadow: 0 0 0 var(--ink);

}

.file-btn {

  cursor: pointer;

}



.settings-footer {

  display: flex;

  justify-content: flex-end;

  gap: 12px;

  margin-top: 20px;

  padding-top: 8px;

}



.panel--monitor .repo-list {

  max-height: 220px;

  overflow-y: auto;

}

.repo-row {

  display: grid;

  grid-template-columns: 72px 1fr minmax(140px, 1.4fr) 36px;

  gap: 8px;

  align-items: center;

  margin-bottom: 8px;

}

.path-cell {

  display: flex;

  gap: 4px;

  min-width: 0;

}

.path-input {

  flex: 1;

  min-width: 0;

  cursor: pointer;

}



.doodle-link {

  font-family: inherit;

  font-size: 14px;

  font-weight: 800;

  color: var(--input-focus);

  background: none;

  border: none;

  cursor: pointer;

  text-decoration: underline;

  text-underline-offset: 3px;

}

.repo-toolbar {

  display: flex;

  justify-content: space-between;

  align-items: center;

  font-weight: 700;

  color: var(--ink);

}

.doodle-icon-btn {

  width: 36px;

  height: 36px;

  font-size: 16px;

  font-weight: 900;

  color: var(--ink);

  background: #fff;

  border: var(--border-width) solid var(--ink);

  border-radius: 8px;

  box-shadow: 2px 2px 0 var(--ink);

  cursor: pointer;

}

.doodle-icon-btn:disabled {

  opacity: 0.5;

  cursor: wait;

}



.hint {

  font-size: 12px;

  font-weight: 600;

  color: #555;

  margin: 0;

}

.picking {

  color: var(--input-focus);

}

</style>
