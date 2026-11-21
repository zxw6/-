import { ref, computed } from 'vue';
import { messages } from './messages.js';

const locale = ref('zh-CN');

export function getLocale() {
  return locale.value;
}

export function setLocale(code) {
  if (messages[code]) locale.value = code;
}

export function useI18n() {
  const dict = computed(() => messages[locale.value] ?? messages['zh-CN']);

  const t = (key, params = {}) => {
    let s = dict.value[key] ?? messages['zh-CN'][key] ?? key;
    for (const [k, v] of Object.entries(params)) {
      s = s.replaceAll(`{${k}}`, String(v));
    }
    return s;
  };

  const monthLabel = (monthIndex) => dict.value.months?.[monthIndex] ?? '';

  return { locale, setLocale, t, monthLabel };
}