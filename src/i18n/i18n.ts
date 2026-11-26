import { useSyncExternalStore } from 'react';
import { setLocale } from '../engine/locale.ts';
import { de } from './de.ts';
import { en, type Message, type MessageKey, type Messages } from './en.ts';

export type Language = 'en' | 'de';
export type LanguagePreference = 'system' | Language;
export type { MessageKey };

export const LANGUAGES: { id: Language; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'de', name: 'Deutsch' },
];

const CATALOGS: Record<Language, Messages> = { en, de };
/** How amounts and dates are written in each language. */
const LOCALES: Record<Language, string> = { en: 'en-US', de: 'de-DE' };

export const LANGUAGE_KEY = 'budget-language';

export const parseLanguagePreference = (value: string | null): LanguagePreference =>
  value === 'en' || value === 'de' ? value : 'system';

/** "system" takes the first of the browser's languages the app has, and English otherwise. */
export function resolveLanguage(preference: LanguagePreference, browserLanguages: readonly string[]): Language {
  if (preference !== 'system') return preference;
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split('-')[0];
    if (base === 'de' || base === 'en') return base;
  }
  return 'en';
}

export type Vars = Record<string, string | number>;

/** Fills {name} placeholders; a message with one/other forms picks one by `count`. */
export function translate(language: Language, key: MessageKey, vars: Vars = {}): string {
  const message: Message = CATALOGS[language][key];
  let text: string;
  if (typeof message === 'string') text = message;
  else {
    const count = Number(vars.count ?? 0);
    text = new Intl.PluralRules(LOCALES[language]).select(count) === 'one' ? message.one : message.other;
  }
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

// The current language: one value for the whole app, like the theme.
let language: Language = 'en';
const listeners = new Set<() => void>();

function apply(next: Language) {
  language = next;
  setLocale(LOCALES[next]);
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  for (const l of listeners) l();
}

const browserLanguages = () => (typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : []);

/** The saved choice. It is a setting of this device, so it is not part of backups. */
export function loadLanguagePreference(): LanguagePreference {
  try {
    return parseLanguagePreference(localStorage.getItem(LANGUAGE_KEY));
  } catch {
    return 'system';
  }
}

export function initLanguage() {
  apply(resolveLanguage(loadLanguagePreference(), browserLanguages()));
}

export function setLanguagePreference(preference: LanguagePreference) {
  try {
    localStorage.setItem(LANGUAGE_KEY, preference);
  } catch {
    /* not remembered; lasts until reload */
  }
  apply(resolveLanguage(preference, browserLanguages()));
}

const subscribe = (onChange: () => void) => {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
};

export const useLanguage = () => useSyncExternalStore(subscribe, () => language, () => language);

/** Translation outside React components (e.g. confirmation texts built in event handlers). */
export const t = (key: MessageKey, vars?: Vars) => translate(language, key, vars);

/** Translation in components; they re-render when the language changes. */
export function useT() {
  const current = useLanguage();
  return (key: MessageKey, vars?: Vars) => translate(current, key, vars);
}
