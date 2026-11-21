<script setup>

import { computed } from 'vue';

import { useI18n } from '../i18n/index.js';

import ProfileCardBanner from './ProfileCardBanner.vue';
import WeatherScapeCard from './WeatherScapeCard.vue';



const props = defineProps({

  profile: { type: Object, required: true },

  live: { type: Boolean, default: false },

  repoCount: { type: Number, default: 0 },

  avatarSrc: { type: String, default: '' },

});



const emit = defineEmits(['edit-profile', 'weather-location']);



const { t } = useI18n();



const initials = computed(() => {

  const s = props.profile.nickname || props.profile.username || '?';

  return s.slice(0, 1).toUpperCase();

});



const timeLabel = computed(() => {

  const d = new Date();

  const h = String(d.getHours()).padStart(2, '0');

  const m = String(d.getMinutes()).padStart(2, '0');

  const offset = -d.getTimezoneOffset() / 60;

  const sign = offset >= 0 ? '+' : '';

  return `${h}:${m} (UTC ${sign}${offset})`;

});



const statusText = computed(() => {

  const state = props.live ? t('listening') : t('idle');

  return `${state} · ${t('reposCount', { n: props.repoCount })}`;

});

</script>



<template>

  <aside class="profile-side">
    <div class="profile-stack">
    <!-- 布局参考 Uiverse.io by andrew-demchenk0 -->
    <div class="card">

      <div class="card__img">

        <ProfileCardBanner />

      </div>



      <div class="card__avatar">
        <!-- 闲置时 Z 飘动，参考 Uiverse.io by necatimertmetin -->
        <div v-if="!live" class="avatar-zzz" aria-hidden="true">
          <span class="z z-1">Z</span>
          <span class="z z-2">Z</span>
          <span class="z z-3">Z</span>
          <span class="z z-4">Z</span>
        </div>
        <img v-if="avatarSrc" class="card__avatar-img" :src="avatarSrc" :alt="profile.username" />
        <div v-else class="card__avatar-fallback">{{ initials }}</div>
      </div>



      <h1 class="card__title">{{ profile.username }}</h1>

      <p v-if="profile.nickname" class="card__subtitle">{{ profile.nickname }}</p>

      <p v-if="profile.bio" class="card__bio">{{ profile.bio }}</p>

      <div class="card__wrapper">

        <button type="button" class="card__btn card__btn--block" @click="emit('edit-profile')">

          {{ t('editProfile') }}

        </button>

      </div>



      <footer class="card__footer">

        <p class="card__meta">

          <span class="card__clock" aria-hidden="true">🕐</span>

          {{ timeLabel }}

        </p>

        <p class="card__live" :class="{ on: live }">

          <span class="card__dot" aria-hidden="true">●</span>

          {{ statusText }}

        </p>

      </footer>

    </div>

    <WeatherScapeCard
      :city="profile.city"
      :locale="profile.locale"
      :weather-auto-locate="profile.weatherAutoLocate !== false"
      :weather-lat="profile.weatherLat"
      :weather-lon="profile.weatherLon"
      @weather-location="emit('weather-location', $event)"
    />
    </div>
  </aside>

</template>



<style scoped>

.profile-side {

  width: 300px;

  flex-shrink: 0;

  display: flex;

  justify-content: center;

}

.profile-stack {

  display: flex;

  flex-direction: column;

  align-items: center;

  gap: 20px;

  width: 100%;

  max-width: 300px;

}



.card {

  --main-color: var(--text);

  --submain-color: var(--text-secondary);

  --bg-color: var(--panel);

  position: relative;

  width: 100%;

  max-width: 300px;

  min-height: 400px;

  display: flex;

  flex-direction: column;

  align-items: center;

  border-radius: 20px;

  background: var(--bg-color);

  border: 1px solid var(--border);

  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);

  padding-bottom: 16px;

}



.card__img {

  height: 192px;

  width: 100%;

  border-radius: 20px 20px 0 0;

  overflow: hidden;

}



.card__img :deep(svg) {

  display: block;

  width: 100%;

  height: 100%;

}



.card__avatar {

  position: absolute;

  width: 114px;

  height: 114px;

  background: var(--bg-color);

  border-radius: 100%;

  display: flex;

  justify-content: center;

  align-items: center;

  top: calc(192px - 57px);

  left: 50%;

  transform: translateX(-50%);

  box-shadow: 0 0 0 4px var(--bg-color);

  overflow: visible;

  z-index: 4;

}

.avatar-zzz {

  position: absolute;

  top: 8px;

  left: 50%;

  width: 0;

  height: 0;

  z-index: 6;

  pointer-events: none;

}

.avatar-zzz .z {

  position: absolute;

  font-size: 20px;

  font-weight: 700;

  color: var(--ink, #323232);

  opacity: 0;

  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.6);

  font-family: 'Comic Sans MS', 'Chalkboard SE', sans-serif;

}

.avatar-zzz .z-1 {

  animation: avatar-sway-z 2s ease-out infinite;

}

.avatar-zzz .z-2 {

  animation: avatar-sway-z 2s ease-out 0.5s infinite;

}

.avatar-zzz .z-3 {

  animation: avatar-sway-z 2s ease-out 1s infinite;

}

.avatar-zzz .z-4 {

  animation: avatar-sway-z 2s ease-out 1.5s infinite;

}

@keyframes avatar-sway-z {

  0% {

    transform: translate(0, 0) rotate(0deg);

    opacity: 1;

  }

  100% {

    transform: translate(48px, -56px) rotate(24deg);

    opacity: 0;

  }

}



.card__avatar-img {

  width: 100px;

  height: 100px;

  border-radius: 50%;

  object-fit: cover;

  display: block;

}



.card__avatar-fallback {

  width: 100px;

  height: 100px;

  border-radius: 50%;

  display: flex;

  align-items: center;

  justify-content: center;

  font-size: 40px;

  font-weight: 600;

  color: #fff;

  background: linear-gradient(135deg, #388bfd 0%, #8957e5 100%);

}



.card__title {

  margin: 60px 16px 0;

  font-weight: 600;

  font-size: 20px;

  line-height: 1.3;

  color: var(--main-color);

  text-align: center;

  word-break: break-word;

}



.card__subtitle {

  margin: 8px 16px 0;

  font-weight: 400;

  font-size: 15px;

  color: var(--submain-color);

  text-align: center;

}



.card__bio {

  margin: 12px 20px 0;

  font-size: 14px;

  line-height: 1.5;

  color: var(--main-color);

  text-align: center;

  word-break: break-word;

}

.card__wrapper {

  margin-top: 16px;

  width: 100%;

  padding: 0 20px;

  box-sizing: border-box;

}



.card__btn {

  border: 2px solid var(--main-color);

  border-radius: 8px;

  font-weight: 600;

  font-size: 14px;

  color: var(--main-color);

  background: var(--bg-color);

  cursor: pointer;

  transition: background 0.25s ease, color 0.25s ease;

}



.card__btn--block {

  width: 100%;

  padding: 8px 16px;

}



.card__btn:hover {

  background: var(--main-color);

  color: var(--bg-color);

}



.card__footer {

  margin-top: 16px;

  width: 100%;

  padding: 0 20px;

  text-align: center;

}



.card__meta {

  margin: 0 0 6px;

  font-size: 13px;

  color: var(--submain-color);

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 6px;

}



.card__live {

  margin: 0;

  font-size: 12px;

  color: var(--muted);

  display: flex;

  align-items: center;

  justify-content: center;

  gap: 4px;

}



.card__live.on {

  color: var(--accent-2);

}



.card__live.on .card__dot {

  color: var(--accent-2);

}



@media (max-width: 1012px) {

  .profile-side {

    width: 100%;

  }

  .profile-stack {

    max-width: 340px;

    margin: 0 auto;

  }

}

</style>
