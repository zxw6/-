<!-- 布局参考 Uiverse.io by KSAplay；天气数据 Open-Meteo -->
<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { fetchWeather } from '../api.js';
import { useI18n } from '../i18n/index.js';

const props = defineProps({
  city: { type: String, default: '' },
  locale: { type: String, default: 'zh-CN' },
  weatherAutoLocate: { type: Boolean, default: true },
  weatherLat: { type: Number, default: null },
  weatherLon: { type: Number, default: null },
});

const emit = defineEmits(['weather-location']);

const { t } = useI18n();

const treeIcon =
  'M32,0C18.148,0,12,23.188,12,32c0,9.656,6.883,17.734,16,19.594V60c0,2.211,1.789,4,4,4s4-1.789,4-4v-8.406 C45.117,49.734,52,41.656,52,32C52,22.891,46.051,0,32,0z';

const WEATHER_CACHE_KEY = 'code-workbench-weather-cache';

const loading = ref(true);
const error = ref('');
const wx = ref(null);

function readWeatherCache(cityKey) {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    const key = String(cityKey ?? '').trim() || '__default__';
    if (parsed.cityKey !== key) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeWeatherCache(cityKey, data) {
  try {
    const key = String(cityKey ?? '').trim() || '__default__';
    localStorage.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({ cityKey: key, data, ts: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

const dateLocale = computed(() => (props.locale?.startsWith('zh') ? 'zh-CN' : 'en-US'));

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(dateLocale.value, {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  });
}

const todayLabel = computed(() => formatDate(wx.value?.today?.date ?? ''));
const cityLabel = computed(() => wx.value?.city ?? props.city ?? '—');
const conditionLabel = computed(() => wx.value?.current?.label ?? '—');
const todayTemp = computed(() => (wx.value ? `${wx.value.current?.temp ?? wx.value.today?.temp}°C` : '—'));

const forecastRows = computed(() => {
  const list = wx.value?.forecast ?? [];
  return list.map((row) => ({
    key: row.date,
    label: formatDate(row.date),
    temp: `${row.tempMax}°C`,
    sub: row.label,
  }));
});

function weatherCacheKey(lat, lon) {
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `geo:${lat.toFixed(3)},${lon.toFixed(3)}`;
  }
  return String(props.city ?? '').trim() || '__default__';
}

function getBrowserPosition() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('unsupported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12000,
      maximumAge: 300000,
    });
  });
}

async function resolveCoords() {
  const auto = props.weatherAutoLocate !== false;
  if (!auto) return null;

  try {
    const pos = await getBrowserPosition();
    return { lat: pos.coords.latitude, lon: pos.coords.longitude, fresh: true };
  } catch {
    if (Number.isFinite(props.weatherLat) && Number.isFinite(props.weatherLon)) {
      return { lat: props.weatherLat, lon: props.weatherLon, fresh: false };
    }
    return null;
  }
}

function shouldPersistLocation(city, lat, lon) {
  const prevCity = String(props.city ?? '').trim();
  const nextCity = String(city ?? '').trim();
  const latOk = Number.isFinite(lat);
  const lonOk = Number.isFinite(lon);
  const prevLat = props.weatherLat;
  const prevLon = props.weatherLon;
  const moved =
    latOk &&
    lonOk &&
    (!Number.isFinite(prevLat) ||
      !Number.isFinite(prevLon) ||
      Math.abs(prevLat - lat) > 0.02 ||
      Math.abs(prevLon - lon) > 0.02);
  return moved || (nextCity && nextCity !== prevCity);
}

async function loadWeather() {
  let cacheKey = weatherCacheKey(props.weatherLat, props.weatherLon);
  if (props.weatherAutoLocate === false) {
    cacheKey = weatherCacheKey(null, null);
  }

  const cached = readWeatherCache(cacheKey);
  if (cached) {
    wx.value = cached;
    loading.value = false;
    error.value = '';
  } else {
    loading.value = true;
    error.value = '';
  }

  let usedGeo = false;
  let geoDenied = false;

  try {
    const coords = await resolveCoords();
    let res;
    if (coords) {
      usedGeo = true;
      res = await fetchWeather({ lat: coords.lat, lon: coords.lon });
      cacheKey = weatherCacheKey(coords.lat, coords.lon);
    } else if (props.weatherAutoLocate !== false) {
      geoDenied = true;
      res = await fetchWeather(props.city);
      cacheKey = weatherCacheKey(null, null);
    } else {
      res = await fetchWeather(props.city);
    }

    if (!res.ok) {
      if (!cached) {
        error.value = geoDenied ? 'geo' : res.error || 'failed';
        wx.value = null;
      }
    } else {
      const { ok, ...data } = res;
      wx.value = data;
      writeWeatherCache(cacheKey, data);
      error.value = '';

      const lat = data.latitude ?? coords?.lat;
      const lon = data.longitude ?? coords?.lon;
      if (usedGeo && coords?.fresh && shouldPersistLocation(data.city, lat, lon)) {
        emit('weather-location', {
          city: data.city,
          weatherLat: lat,
          weatherLon: lon,
        });
      }
    }
  } catch {
    if (!cached) {
      error.value = 'network';
      wx.value = null;
    }
  } finally {
    loading.value = false;
  }
}

onMounted(() => void loadWeather());
watch(
  () => [props.city, props.weatherAutoLocate, props.weatherLat, props.weatherLon],
  () => void loadWeather(),
);
</script>

<template>
  <div class="weather-card-wrap">
    <div class="weather-card">
      <section class="landscape-section">
        <div class="sky" />
        <div class="sun" />
        <div class="hill-1" />
        <div class="hill-2" />
        <div class="ocean">
          <div v-for="n in 5" :key="n" class="reflection" />
          <div class="shadow-hill-1" />
          <div class="shadow-hill-2" />
        </div>
        <div class="hill-3" />
        <div class="hill-4" />
        <div class="tree tree-1">
          <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path :d="treeIcon" fill="#b77873" />
          </svg>
        </div>
        <div class="tree tree-2">
          <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path :d="treeIcon" fill="#b77873" />
          </svg>
        </div>
        <div class="tree tree-3">
          <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path :d="treeIcon" fill="#a16773" />
          </svg>
        </div>
        <div class="filter" />

        <div v-if="!loading && wx" class="weather-info">
          <div class="left-side">
            <div class="icon">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  stroke-linecap="round"
                  stroke-width="1.5"
                  stroke="#ffffff"
                  d="M22 14.3529C22 17.4717 19.4416 20 16.2857 20H11M14.381 9.02721C14.9767 8.81911 15.6178 8.70588 16.2857 8.70588C16.9404 8.70588 17.5693 8.81468 18.1551 9.01498M7.11616 11.6089C6.8475 11.5567 6.56983 11.5294 6.28571 11.5294C3.91878 11.5294 2 13.4256 2 15.7647C2 18.1038 3.91878 20 6.28571 20H7M7.11616 11.6089C6.88706 10.9978 6.7619 10.3369 6.7619 9.64706C6.7619 6.52827 9.32028 4 12.4762 4C15.4159 4 17.8371 6.19371 18.1551 9.01498M7.11616 11.6089C7.68059 11.7184 8.20528 11.9374 8.66667 12.2426M18.1551 9.01498C18.8381 9.24853 19.4623 9.60648 20 10.0614"
                />
              </svg>
            </div>
            <p class="condition">{{ conditionLabel }}</p>
          </div>
          <div class="right-side">
            <div class="location" :title="cityLabel">
              <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path
                  fill="#ffffff"
                  d="M32,0C18.746,0,8,10.746,8,24c0,5.219,1.711,10.008,4.555,13.93c0.051,0.094,0.059,0.199,0.117,0.289l16,24 C29.414,63.332,30.664,64,32,64s2.586-0.668,3.328-1.781l16-24c0.059-0.09,0.066-0.195,0.117-0.289C54.289,34.008,56,29.219,56,24 C56,10.746,45.254,0,32,0z M32,32c-4.418,0-8-3.582-8-8s3.582-8,8-8s8,3.582,8,8S36.418,32,32,32z"
                />
              </svg>
              <span>{{ cityLabel }}</span>
            </div>
            <p class="date-line">{{ todayLabel }}</p>
            <p class="temperature">{{ todayTemp }}</p>
          </div>
        </div>
      </section>

      <section class="content-section">
        <p v-if="loading" class="state-msg">{{ t('weatherLoading') }}</p>
        <p v-else-if="error" class="state-msg state-msg--err">
          {{ error === 'geo' ? t('weatherErrorGeo') : t('weatherError') }}
        </p>
        <p v-else-if="!forecastRows.length" class="state-msg">—</p>
        <div v-else class="forecast">
          <template v-for="(row, idx) in forecastRows" :key="row.key">
            <div v-if="idx > 0" class="separator" />
            <div class="forecast-row">
              <div class="forecast-day">
                <p class="forecast-date">{{ row.label }}</p>
                <p class="forecast-sub">{{ row.sub }}</p>
              </div>
              <p class="forecast-temp">{{ row.temp }}</p>
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.weather-card-wrap {
  width: 100%;
  display: flex;
  justify-content: center;
}

.weather-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  width: 100%;
  max-width: 300px;
  min-height: 400px;
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 12px 12px 0 rgba(0, 0, 0, 0.1);
  background-color: #ffffff;
  border: 1px solid var(--border);
}

.landscape-section {
  position: relative;
  width: 100%;
  height: 265px;
  flex-shrink: 0;
  overflow: hidden;
}

.landscape-section > * {
  position: absolute;
}

.sky {
  width: 100%;
  height: 100%;
  background: linear-gradient(0deg, rgba(247, 225, 87, 1) 0%, rgba(233, 101, 148, 1) 100%);
}

.sun {
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background-color: white;
  bottom: 42%;
  left: 23%;
  filter: drop-shadow(0 0 10px white);
}

.sun::after,
.sun::before {
  position: absolute;
  content: '';
  border-radius: 50%;
  background-color: white;
}

.sun::after {
  width: 118%;
  height: 118%;
  opacity: 0.5;
}

.sun::before {
  width: 134%;
  height: 134%;
  opacity: 0.1;
}

.ocean {
  overflow: hidden;
  bottom: 0;
  width: 100%;
  height: 28%;
  background: linear-gradient(0deg, rgba(241, 192, 125, 1) 0%, rgba(247, 218, 150, 1) 100%);
}

.reflection {
  background-color: white;
  opacity: 0.5;
  z-index: 1;
}

.reflection:nth-child(1) {
  width: 40px;
  height: 10px;
  clip-path: polygon(0% 0%, 100% 0%, 50% 20%);
  top: 5%;
  left: 32%;
}

.reflection:nth-child(2) {
  width: 80px;
  height: 15px;
  clip-path: polygon(0% 0%, 100% 0%, 60% 20%, 40% 20%);
  top: 15%;
  left: 39%;
}

.reflection:nth-child(3) {
  width: 60px;
  height: 2px;
  clip-path: polygon(0% 50%, 40% 0%, 60% 0%, 100% 50%, 60% 100%, 40% 100%);
  top: 27%;
  right: 15%;
}

.reflection:nth-child(4) {
  width: 70px;
  height: 2px;
  clip-path: polygon(0% 50%, 40% 0%, 60% 0%, 100% 50%, 60% 100%, 40% 100%);
  top: 37%;
  right: 28%;
}

.reflection:nth-child(5) {
  width: 70px;
  height: 3px;
  clip-path: polygon(0% 50%, 40% 0%, 60% 0%, 100% 50%, 60% 100%, 40% 100%);
  top: 46%;
  right: 8%;
}

.hill-1 {
  right: -25%;
  bottom: 20%;
  width: 150px;
  height: 40px;
  border-radius: 50%;
  background-color: #e6b29d;
}

.shadow-hill-1 {
  right: -25%;
  top: -30%;
  width: 150px;
  height: 40px;
  border-radius: 50%;
  background-color: #f1c7a0;
}

.hill-2 {
  right: -36%;
  bottom: 10%;
  width: 150px;
  height: 80px;
  border-radius: 50%;
  background-color: #c29182;
}

.shadow-hill-2 {
  right: -36%;
  top: -65%;
  width: 150px;
  height: 80px;
  border-radius: 50%;
  background-color: #e5bb96;
}

.hill-3 {
  left: -100%;
  bottom: -28%;
  width: 350px;
  height: 150px;
  border-radius: 50%;
  background-color: #b77873;
  z-index: 3;
}

.hill-4 {
  right: -100%;
  bottom: -40%;
  width: 350px;
  height: 150px;
  border-radius: 50%;
  background-color: #a16773;
  z-index: 3;
}

.tree {
  z-index: 3;
}

.tree svg {
  width: 100%;
  height: 100%;
  display: block;
}

.tree-1 {
  bottom: 20%;
  left: 3%;
  width: 50px;
  height: 70px;
}

.tree-2 {
  bottom: 14%;
  left: 25%;
  width: 50px;
  height: 70px;
}

.tree-3 {
  bottom: 10%;
  right: 1%;
  width: 65px;
  height: 80px;
}

.filter {
  height: 100%;
  width: 100%;
  background: linear-gradient(0deg, rgba(255, 255, 255, 1) 0%, rgba(255, 255, 255, 0) 40%);
  z-index: 5;
  opacity: 0.2;
  pointer-events: none;
}

.weather-info {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  left: 0;
  right: 0;
  bottom: 10px;
  padding: 0 14px;
  color: white;
  z-index: 10;
  box-sizing: border-box;
}

.left-side {
  flex: 0 0 auto;
  max-width: 38%;
  text-align: left;
}

.condition {
  margin: 4px 0 0;
  font-size: 11px;
  font-weight: 600;
}

.icon svg {
  width: 36px;
  height: 36px;
  display: block;
}

.right-side {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
}

.location {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  max-width: 100%;
  margin: 0;
}

.location span {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

.location svg {
  width: 14px;
  flex-shrink: 0;
}

.date-line {
  margin: 2px 0 0;
  font-size: 11px;
  line-height: 1.35;
  white-space: nowrap;
}

.temperature {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
}

.content-section {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #fff;
  padding: 12px 0 14px;
  min-height: 130px;
  box-sizing: border-box;
}

.state-msg {
  margin: 0;
  padding: 8px 20px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
}

.state-msg--err {
  color: #cf222e;
}

.forecast {
  width: 100%;
  padding: 0 18px;
  box-sizing: border-box;
}

.forecast-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 36px;
}

.forecast-day {
  min-width: 0;
  flex: 1;
}

.forecast-date {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  color: #59636e;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.forecast-sub {
  margin: 2px 0 0;
  font-size: 10px;
  color: #8b949e;
}

.forecast-temp {
  margin: 0;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: #1f2328;
}

.separator {
  width: 100%;
  height: 2px;
  margin: 4px 0;
  background-color: rgb(233, 233, 233);
  border-radius: 1px;
}

:global([data-theme='dark']) .weather-card {
  box-shadow: 12px 12px 0 rgba(0, 0, 0, 0.35);
}

:global([data-theme='dark']) .content-section {
  background: #1a1f24;
}

:global([data-theme='dark']) .forecast-date {
  color: #c9d1d9;
}

:global([data-theme='dark']) .forecast-temp {
  color: #e6edf3;
}

:global([data-theme='dark']) .separator {
  background-color: var(--border);
}
</style>