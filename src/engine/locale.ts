/**
 * The locale used to format amounts, months and dates (e.g. "en-US", "de-DE").
 * Set by the language setting (src/i18n); stays "en-US" in tests and until a language is chosen.
 */
let current = 'en-US';

export const getLocale = () => current;

export function setLocale(locale: string) {
  current = locale;
}
