const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const GEO_REVERSE_URL = 'https://geocoding-api.open-meteo.com/v1/reverse';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const LABELS_ZH = [
  [0, '晴'],
  [3, '多云'],
  [48, '雾'],
  [67, '雨'],
  [82, '阵雨'],
  [95, '雷雨'],
];

const LABELS_EN = [
  [0, 'Clear'],
  [3, 'Cloudy'],
  [48, 'Fog'],
  [67, 'Rain'],
  [82, 'Showers'],
  [95, 'Thunderstorm'],
];

function weatherLabel(code, lang) {
  const table = lang.startsWith('zh') ? LABELS_ZH : LABELS_EN;
  const c = Number(code);
  for (const [max, label] of table) {
    if (c <= max) return label;
  }
  return lang.startsWith('zh') ? '多云' : 'Cloudy';
}

function localTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function fetchForecastAt(latitude, longitude, lang, cityName, region) {
  const qs = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code',
    daily: 'weather_code,temperature_2m_max',
    timezone: 'auto',
    forecast_days: '4',
  });
  const wxRes = await fetch(`${FORECAST_URL}?${qs}`);
  if (!wxRes.ok) throw new Error('forecast failed');
  const wx = await wxRes.json();

  const daily = wx.daily ?? {};
  const dates = daily.time ?? [];
  const codes = daily.weather_code ?? [];
  const temps = daily.temperature_2m_max ?? [];

  const today = localTodayKey();
  const forecast = [];
  for (let i = 0; i < dates.length; i += 1) {
    if (dates[i] <= today) continue;
    forecast.push({
      date: dates[i],
      tempMax: Math.round(temps[i] ?? 0),
      code: codes[i],
      label: weatherLabel(codes[i], lang),
    });
    if (forecast.length >= 3) break;
  }

  const current = wx.current ?? {};
  const todayIdx = dates.indexOf(today);
  const todayTemp =
    todayIdx >= 0
      ? Math.round(temps[todayIdx] ?? current.temperature_2m ?? 0)
      : Math.round(current.temperature_2m ?? 0);
  const todayCode = todayIdx >= 0 ? codes[todayIdx] : current.weather_code;

  return {
    city: cityName,
    region: region ?? '',
    latitude,
    longitude,
    current: {
      temp: Math.round(current.temperature_2m ?? todayTemp),
      code: current.weather_code ?? todayCode,
      label: weatherLabel(current.weather_code ?? todayCode, lang),
    },
    today: {
      date: today,
      temp: todayTemp,
      label: weatherLabel(todayCode, lang),
    },
    forecast,
  };
}

export async function fetchWeatherForCoords(latitude, longitude, lang = 'zh') {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('invalid coordinates');

  const revQs = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    language: lang.startsWith('zh') ? 'zh' : 'en',
    count: '1',
  });
  const revRes = await fetch(`${GEO_REVERSE_URL}?${revQs}`);
  if (!revRes.ok) throw new Error('reverse geocoding failed');
  const rev = await revRes.json();
  const hit = rev.results?.[0];
  const cityName = hit?.name || hit?.admin2 || (lang.startsWith('zh') ? '当前位置' : 'Here');
  const region = hit?.admin1 ?? '';
  return fetchForecastAt(lat, lon, lang, cityName, region);
}

export async function fetchWeatherForCity(city, lang = 'zh') {
  const name = String(city ?? '').trim() || (lang.startsWith('zh') ? '厦门' : 'Xiamen');
  const geoRes = await fetch(
    `${GEO_URL}?name=${encodeURIComponent(name)}&count=1&language=${lang}&format=json`,
  );
  if (!geoRes.ok) throw new Error('geocoding failed');
  const geo = await geoRes.json();
  const hit = geo.results?.[0];
  if (!hit) throw new Error('city not found');

  const { latitude, longitude, name: cityName, admin1 } = hit;
  return fetchForecastAt(latitude, longitude, lang, cityName || name, admin1);
}