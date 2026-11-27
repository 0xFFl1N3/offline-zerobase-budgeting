import { parseMoney } from './money.ts';
import type { BudgetState, Cents, Transaction } from './types.ts';
import { RuleError } from './ruleError.ts';

export type DateFormat = 'DMY' | 'MDY' | 'YMD';

/** Which column holds what. Column numbers count from 0; null = not in the file. */
export interface ColumnMapping {
  date: number;
  /** One signed amount column (negative = money out)... */
  amount: number | null;
  /** ...or separate columns for money in and money out. */
  inflow: number | null;
  outflow: number | null;
  /** Who was paid (used for outflows, and for inflows when `payer` is empty). */
  payee: number | null;
  /** Who paid you (used for inflows). */
  payer: number | null;
  memo: number | null;
  /** Booked or pending; pending rows are imported as not cleared. */
  status: number | null;
  dateFormat: DateFormat;
}

export interface CsvTable {
  header: string[];
  rows: string[][];
  /** A balance named above the table (e.g. "Kontostand vom 26.11.2026: 1.234,98 €"), to compare after importing. */
  statedBalance: { amount: Cents; date: string | null } | null;
}

const DATE_LIKE = /^\d{1,4}[./-]\d{1,2}[./-]\d{1,4}$/;
const isDateLike = (s: string) => DATE_LIKE.test(s.trim());

/**
 * Finds the transaction table in a bank export: the header is the first row followed by a row with a date,
 * so account details and balances above it are skipped.
 */
export function findTable(cells: string[][]): CsvTable | null {
  for (let i = 0; i < cells.length - 1; i++) {
    const header = cells[i]!;
    if (header.filter((c) => c !== '').length < 3 || header.some(isDateLike)) continue;
    if (!cells[i + 1]!.some(isDateLike)) continue;
    const rows = cells.slice(i + 1).filter((r) => r.some(isDateLike));
    return { header, rows, statedBalance: findStatedBalance(cells.slice(0, i)) };
  }
  return null;
}

function findStatedBalance(preamble: string[][]): CsvTable['statedBalance'] {
  for (const row of preamble) {
    const label = row.find((c) => /kontostand|saldo|balance/i.test(c));
    if (!label) continue;
    const amount = row.filter((c) => c !== label).map((c) => parseMoney(c)).find((a) => a !== null);
    if (amount === undefined || amount === null) continue;
    const m = label.match(/(\d{1,2}\.\d{1,2}\.\d{2,4}|\d{4}-\d{2}-\d{2})/);
    return { amount, date: m ? parseDate(m[1]!, m[1]!.includes('-') ? 'YMD' : 'DMY') : null };
  }
  return null;
}

const findColumn = (header: string[], patterns: RegExp[], taken: Set<number> = new Set()): number | null => {
  for (const re of patterns) {
    const i = header.findIndex((h, idx) => !taken.has(idx) && re.test(h.toLowerCase()));
    if (i >= 0) return i;
  }
  return null;
};

/** A first guess of the mapping from the column names (German and English bank exports). */
export function guessMapping(table: CsvTable): ColumnMapping {
  const h = table.header;
  const date = findColumn(h, [/buchungsdatum|buchungstag/, /^datum$|^date$/, /datum|date/]) ?? table.rows[0]!.findIndex(isDateLike);
  let amount = findColumn(h, [/betrag|amount/]);
  const inflow = amount === null ? findColumn(h, [/^haben|credit|inflow|gutschrift|eingang$/]) : null;
  const outflow = amount === null ? findColumn(h, [/^soll|debit|outflow|lastschrift|ausgang$/]) : null;
  if (amount === null && (inflow === null || outflow === null)) {
    // No named amount column: take the first column where every value is money and not a date.
    const i = h.findIndex((_, col) => col !== date && table.rows.every((r) => r[col] !== undefined && r[col] !== '' && !isDateLike(r[col]!) && parseMoney(r[col]!) !== null));
    amount = i >= 0 ? i : null;
  }
  const payer = findColumn(h, [/zahlungspflichtig|auftraggeber|payer|absender/]);
  const payee = findColumn(h, [/empf[äa]nger|payee|beg[üu]nstigt|recipient/, /name|gegenpartei|counterparty/], new Set(payer === null ? [] : [payer]));
  return {
    date,
    amount: inflow !== null && outflow !== null ? null : amount,
    inflow: inflow !== null && outflow !== null ? inflow : null,
    outflow: inflow !== null && outflow !== null ? outflow : null,
    payee,
    payer,
    memo: findColumn(h, [/verwendungszweck/, /memo|purpose|description|buchungstext|beschreibung/]),
    status: findColumn(h, [/^status$/]),
    dateFormat: detectDateFormat(table.rows.map((r) => r[date] ?? '')),
  };
}

/** 'YYYY-MM-DD', or null if the text is not a real date in that format. Two-digit years mean 20xx. */
export function parseDate(text: string, format: DateFormat): string | null {
  const parts = text.trim().split(/[./-]/);
  if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const [a, b, c] = parts.map(Number) as [number, number, number];
  let [y, m, d] = format === 'YMD' ? [a, b, c] : format === 'DMY' ? [c, b, a] : [c, a, b];
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const real = new Date(Date.UTC(y, m - 1, d));
  if (real.getUTCMonth() !== m - 1) return null; // e.g. 31 April
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** The format that reads every date; dotted dates are day first, as German banks write them. */
export function detectDateFormat(values: string[]): DateFormat {
  const dates = values.map((v) => v.trim()).filter(isDateLike);
  if (dates.length === 0) return 'DMY';
  if (dates.every((v) => /^\d{4}/.test(v))) return 'YMD';
  const fits = (f: DateFormat) => dates.every((v) => parseDate(v, f) !== null);
  if (dates.some((v) => v.includes('.')) && fits('DMY')) return 'DMY';
  if (!fits('DMY') && fits('MDY')) return 'MDY';
  return 'DMY';
}

export interface ImportRow {
  /** Position in the file's table, used as a key. */
  line: number;
  date: string | null;
  payee: string;
  memo: string;
  amount: Cents | null;
  pending: boolean;
  /**
   * A fingerprint of the payment (date, amount, payee, purpose), so the same payment in a later export is recognised.
   * Status and value date are left out: they change when a pending payment is booked.
   */
  importId: string;
  /** The fingerprint used before 0.4.7 (of the whole row), still recognised for transactions imported then. */
  legacyImportId: string;
  /** Why the row cannot be imported, if it can't. */
  problem: string | null;
}

/** 53-bit FNV-style hash as base 36; short and stable, not for security. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Tidies a payee taken from the bank: PayPal payments name the real shop in the purpose ("Ihr Einkauf bei Netflix.com"),
 * so that name is used instead of PayPal's.
 */
export function cleanPayee(payee: string, memo: string): string {
  if (/paypal/i.test(payee)) {
    const shop = memo.match(/einkauf bei\s+(.+?)\s*$/i) ?? memo.match(/purchase (?:at|from)\s+(.+?)\s*$/i);
    if (shop) return shop[1]!;
  }
  return payee.replace(/\s+/g, ' ').trim();
}

const cell = (row: string[], col: number | null) => (col === null ? '' : (row[col] ?? '').trim());

export function readRows(table: CsvTable, mapping: ColumnMapping): ImportRow[] {
  const seen = new Map<string, number>();
  return table.rows.map((row, line) => {
    const date = parseDate(cell(row, mapping.date), mapping.dateFormat);
    let amount: Cents | null;
    if (mapping.amount !== null) amount = parseMoney(cell(row, mapping.amount));
    else {
      const inText = cell(row, mapping.inflow);
      const outText = cell(row, mapping.outflow);
      const inAmount = inText === '' ? 0 : parseMoney(inText);
      const outAmount = outText === '' ? 0 : parseMoney(outText);
      amount = inAmount === null || outAmount === null ? null : Math.abs(inAmount) - Math.abs(outAmount);
    }
    const memo = cell(row, mapping.memo).replace(/\s+/g, ' ');
    const payer = cell(row, mapping.payer);
    const raw = amount !== null && amount > 0 && payer !== '' ? payer : cell(row, mapping.payee) || payer;
    const key = hash([date ?? cell(row, mapping.date), amount ?? '', raw, memo].join('\u001f'));
    const n = (seen.get(key) ?? 0) + 1; // identical payments in one file (two coffees on one day) stay apart
    seen.set(key, n);
    const legacyKey = hash(row.join('\u001f'));
    const legacyN = (seen.get(`legacy:${legacyKey}`) ?? 0) + 1;
    seen.set(`legacy:${legacyKey}`, legacyN);
    const problem = date === null ? 'No valid date' : amount === null ? 'No valid amount' : amount === 0 ? 'Amount is zero' : null;
    return {
      line,
      date,
      payee: cleanPayee(raw, memo),
      memo,
      amount,
      pending: /vorgemerkt|pending|offen|ausstehend/i.test(cell(row, mapping.status)),
      importId: `csv2:${key}${n > 1 ? `#${n}` : ''}`,
      legacyImportId: `csv:${legacyKey}${legacyN > 1 ? `#${legacyN}` : ''}`,
      problem,
    };
  });
}

export type Match =
  /** An earlier import brought in this payment. */
  | { kind: 'imported' }
  /** A transaction entered by hand has the same amount within three days. */
  | { kind: 'likely' }
  /** A pending payment imported earlier is now booked (or changed): importing updates that transaction. */
  | { kind: 'update'; transactionId: string };

const daysApart = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;

/**
 * Which rows are already in the account. Imported payments are recognised by fingerprint. Two looser checks
 * (same amount within three days, each transaction matching one row at most) catch the rest: one against
 * transactions entered by hand, one against payments imported while still pending, whose fingerprint may
 * have changed when the bank booked them. Booked imports are only matched by fingerprint, so two real
 * purchases of the same amount a few days apart never hide each other.
 */
export function findMatches(state: BudgetState, accountId: string, rows: ImportRow[]): Map<number, Match> {
  const result = new Map<number, Match>();
  const own = state.transactions.filter((t) => t.accountId === accountId || t.transferAccountId === accountId);
  const knownIds = new Set(own.map((t) => t.importId).filter((id) => id !== undefined));
  const inFile = new Set(rows.flatMap((r) => [r.importId, r.legacyImportId]));
  const loose = own
    .filter((t) => t.importId === undefined || (t.importPending === true && !inFile.has(t.importId)))
    .map((t) => ({ t, amount: t.accountId === accountId ? t.amount : -t.amount, used: false }));

  for (const row of rows) {
    if (knownIds.has(row.importId) || knownIds.has(row.legacyImportId)) result.set(row.line, { kind: 'imported' });
  }
  for (const row of rows) {
    if (result.has(row.line) || row.date === null || row.amount === null) continue;
    const candidates = loose.filter((m) => !m.used && m.amount === row.amount && daysApart(m.t.date, row.date!) <= 3);
    // Prefer an earlier pending import (it is the same bank payment), then the closest date.
    candidates.sort((a, b) => Number(b.t.importPending === true) - Number(a.t.importPending === true) || daysApart(a.t.date, row.date!) - daysApart(b.t.date, row.date!));
    const best = candidates[0];
    if (!best) continue;
    best.used = true;
    result.set(row.line, best.t.importPending ? { kind: 'update', transactionId: best.t.id } : { kind: 'likely' });
  }
  return result;
}

/**
 * Brings an earlier pending import up to date with its row: the bank's date, the new fingerprint and, once booked,
 * cleared. Payee, category and memo stay as you left them.
 */
export function updateFromRow(t: Transaction, row: ImportRow): Transaction {
  if (row.date === null) throw new RuleError(`Row ${row.line + 1}: ${row.problem}.`);
  const { importPending: _p, cleared: _c, ...rest } = t;
  return {
    ...rest,
    date: row.date,
    importId: row.importId,
    ...(row.pending ? { importPending: true } : { cleared: t.cleared === 'reconciled' ? 'reconciled' : 'cleared' }),
  };
}

const payeeKey = (payee: string, amount: Cents) => `${amount < 0 ? '-' : '+'}${payee.trim().toLowerCase()}`;

/** The category last used for each payee (outflows and refunds separately), from transactions with one category. */
export function payeeMemory(state: BudgetState): Map<string, string> {
  const archived = new Set(state.categories.filter((c) => c.archived).map((c) => c.id));
  const latest = new Map<string, { date: string; categoryId: string }>();
  for (const t of state.transactions) {
    // A debt payment (a transfer with a category) is remembered too, so the next import suggests the debt's category.
    if (t.categoryId === null || t.splits || archived.has(t.categoryId) || t.payee.trim() === '') continue;
    const key = payeeKey(t.payee, t.amount);
    const prev = latest.get(key);
    if (!prev || t.date >= prev.date) latest.set(key, { date: t.date, categoryId: t.categoryId });
  }
  return new Map([...latest].map(([k, v]) => [k, v.categoryId]));
}

export const suggestCategory = (memory: Map<string, string>, payee: string, amount: Cents): string | null =>
  memory.get(payeeKey(payee, amount)) ?? null;

export interface ImportChoice {
  row: ImportRow;
  payee: string;
  categoryId: string | null;
}

/** The transactions to add. Booked rows are cleared (the bank has them), pending ones are not. Every outflow needs a category. */
export function toTransactions(choices: ImportChoice[], accountId: string, newId: () => string): Transaction[] {
  return choices.map(({ row, payee, categoryId }) => {
    if (row.problem !== null || row.date === null || row.amount === null) throw new RuleError(`Row ${row.line + 1}: ${row.problem}.`);
    if (row.amount < 0 && categoryId === null) throw new RuleError(`Row ${row.line + 1} needs a category.`);
    return {
      id: newId(),
      accountId,
      date: row.date,
      payee: payee.trim(),
      categoryId,
      memo: row.memo,
      amount: row.amount,
      transferAccountId: null,
      ...(row.pending ? { importPending: true } : { cleared: 'cleared' as const }),
      importId: row.importId,
    };
  });
}
