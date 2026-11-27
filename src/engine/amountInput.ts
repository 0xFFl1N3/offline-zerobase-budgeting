/**
 * Amounts typed by a person, with simple sums allowed: "100+2,69", "3*12,99", "(480-320)/5". Input without an
 * operator is read exactly as parseMoney reads it today, so nothing that worked before changes. Not for bank files:
 * there "(12,50)" means a negative amount, not a sum.
 */
import { parseMoney } from './money.ts';
import type { Cents } from './types.ts';

const OPERATORS = /[+\-*/x×÷:]/;
/** Also written for times and divided by. */
const ALIASES: Record<string, string> = { x: '*', '×': '*', '÷': '/', ':': '/' };

type Token = { kind: 'num'; value: number } | { kind: 'op'; op: string } | { kind: 'paren'; open: boolean };

function tokenize(text: string): Token[] | null {
  const tokens: Token[] = [];
  const s = text.replace(/[\s€$]/g, '');
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (/[\d.,]/.test(c)) {
      let j = i;
      while (j < s.length && /[\d.,]/.test(s[j]!)) j++;
      const cents = parseMoney(s.slice(i, j));
      if (cents === null) return null;
      tokens.push({ kind: 'num', value: cents / 100 });
      i = j;
    } else if (c === '(' || c === ')') {
      tokens.push({ kind: 'paren', open: c === '(' });
      i++;
    } else if (OPERATORS.test(c)) {
      tokens.push({ kind: 'op', op: ALIASES[c] ?? c });
      i++;
    } else return null;
  }
  return tokens;
}

/** Evaluates tokens with the usual precedence; null for anything that is not a complete sum. */
function evaluate(tokens: Token[]): number | null {
  let pos = 0;
  const peek = () => tokens[pos];
  // expr := term (('+'|'-') term)* ; term := factor (('*'|'/') factor)* ; factor := ('+'|'-') factor | number | '(' expr ')'
  const factor = (): number | null => {
    const t = peek();
    if (!t) return null;
    if (t.kind === 'op' && (t.op === '+' || t.op === '-')) {
      pos++;
      const v = factor();
      return v === null ? null : t.op === '-' ? -v : v;
    }
    if (t.kind === 'num') {
      pos++;
      return t.value;
    }
    if (t.kind === 'paren' && t.open) {
      pos++;
      const v = expr();
      const close = peek();
      if (v === null || !close || close.kind !== 'paren' || close.open) return null;
      pos++;
      return v;
    }
    return null;
  };
  const term = (): number | null => {
    let v = factor();
    while (v !== null) {
      const t = peek();
      if (!t || t.kind !== 'op' || (t.op !== '*' && t.op !== '/')) break;
      pos++;
      const r = factor();
      if (r === null) return null;
      if (t.op === '/' && r === 0) return null;
      v = t.op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number | null => {
    let v = term();
    while (v !== null) {
      const t = peek();
      if (!t || t.kind !== 'op' || (t.op !== '+' && t.op !== '-')) break;
      pos++;
      const r = term();
      if (r === null) return null;
      v = t.op === '+' ? v + r : v - r;
    }
    return v;
  };
  const result = expr();
  return result === null || pos !== tokens.length || !Number.isFinite(result) ? null : result;
}

/**
 * Reads an amount someone typed. A single amount is read as parseMoney reads it. A sum is worked out and rounded to
 * the cent. Starting with "+", "*" or "/" changes `current` (the amount already in the field): "+2,69" on 100,00
 * gives 102,69. A leading "-" keeps meaning a negative amount, as before. Null when it is not a valid amount or sum.
 */
export function parseAmountInput(text: string, current: Cents | null = null): Cents | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const changesCurrent = current !== null && /^[+*/x×÷:]/.test(trimmed);
  // The current amount goes in front as a plain number (e.g. "(85.5)+2,69"), which parseMoney reads as 85,50.
  const input = changesCurrent ? `(${current / 100})${trimmed}` : trimmed;
  const tokens = tokenize(input);
  if (!changesCurrent && (tokens === null || !hasOperator(tokens))) return parseMoney(trimmed);
  if (tokens === null) return null;
  const value = evaluate(tokens);
  if (value === null) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) ? cents + 0 : null; // + 0 turns -0 into 0
}

/** An operator after the first token: a sum, not just a signed amount. */
const hasOperator = (tokens: Token[]) => tokens.some((t, i) => i > 0 && t.kind === 'op');

/** True if the text is a sum (so the field can show its result while typing). */
export function isSum(text: string, current: Cents | null = null): boolean {
  const trimmed = text.trim();
  if (current !== null && /^[+*/x×÷:]/.test(trimmed)) return true;
  const tokens = tokenize(trimmed);
  return tokens !== null && hasOperator(tokens);
}
