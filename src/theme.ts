import { useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_KEY = 'budget-theme';

/** Anything that is not a known choice falls back to following the system. */
export const parsePreference = (value: string | null): ThemePreference => (value === 'light' || value === 'dark' ? value : 'system');

export const resolveTheme = (preference: ThemePreference, systemPrefersDark: boolean): 'light' | 'dark' =>
  preference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : preference;

const systemQuery = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);

/** The saved choice. It is a setting of this device, so it is not part of backups. */
export function loadPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}

export function savePreference(preference: ThemePreference) {
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {
    /* private mode or storage disabled: the choice just lasts until reload */
  }
}

/** Switches the whole app by toggling the `dark` class on <html>. */
export function applyTheme(preference: ThemePreference) {
  const dark = resolveTheme(preference, systemQuery()?.matches ?? false) === 'dark';
  document.documentElement.classList.toggle('dark', dark);
}

/** Applies the saved choice and follows later changes of the system setting while the choice is "system". */
export function initTheme() {
  applyTheme(loadPreference());
  systemQuery()?.addEventListener('change', () => applyTheme(loadPreference()));
}

const isDarkNow = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/** True while the dark theme is showing; re-renders when it changes. */
export const useIsDark = () => useSyncExternalStore(subscribe, isDarkNow, () => false);
