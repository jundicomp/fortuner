export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'fortuner-theme';
export const getThemePref = (): ThemePref => { try { return (localStorage.getItem(KEY) as ThemePref) || 'system'; } catch { return 'system'; } };
export function applyTheme(p: ThemePref) {
  try { localStorage.setItem(KEY, p); } catch { /* abaikan */ }
  const dark = p === 'dark' || (p === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
