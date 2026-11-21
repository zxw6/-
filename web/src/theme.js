const STORAGE_KEY = 'code-workbench-theme';

export function applyTheme(mode) {
  const theme = mode === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function readCachedTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}