import type { Cents } from './types.ts';

export type Currency = 'EUR' | 'USD';

export function formatMoney(cents: Cents, currency: Currency = 'EUR', locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
}

/**
 * Parses user input such as "12.50", "12,50", "1.234,56", "1,234.56", "-5", "(5)", "€ 3".
 * A separator followed by 1-2 digits at the end is the decimal point; otherwise it is a thousands separator.
 * Returns integer cents, or null if the input is not a valid amount.
 */
export function parseMoney(input: string): Cents | null {
  let s = input.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[^\d.,+-]/g, '');
  if (s.startsWith('-')) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;

  const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let intDigits = s;
  let frac = '';
  if (lastSep >= 0) {
    const after = s.slice(lastSep + 1);
    const sepChar = s.charAt(lastSep);
    if (after.length <= 2) {
      if (s.split(sepChar).length - 1 > 1) return null; // e.g. "1.234.56"
      intDigits = s.slice(0, lastSep);
      frac = after;
    }
  }
  intDigits = intDigits.replace(/[.,]/g, '');
  if (intDigits === '') intDigits = '0';
  const cents = Number(intDigits) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) return null;
  return negative && cents !== 0 ? -cents : cents;
}
