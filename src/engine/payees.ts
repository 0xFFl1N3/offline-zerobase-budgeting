/**
 * What the app remembers about payees, worked out from the transactions (nothing is stored for it), so it is
 * right after an import, an undo or a restore.
 */
import { archivedCategoryIds } from './budget.ts';
import type { BudgetState } from './types.ts';

export interface PayeeInfo {
  /** As written the last time it was used. */
  name: string;
  /** How often it was used. */
  count: number;
  lastDate: string;
  /** Whether the last transaction was money in or out. */
  kind: 'inflow' | 'outflow';
  /**
   * The category last used for money out and for money in (a refund), from transactions with exactly one category
   * that is still active. Splits and uncategorized transactions leave it as it was.
   */
  categoryFor: { outflow: string | null; inflow: string | null };
}

/** Payees are the same when they only differ in case or spacing. */
export const payeeKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/**
 * Every payee, by payeeKey: used by the payee field and by the bank import. Transfers are left out, except debt
 * payments (a transfer with a category), so a payment to a debt is suggested its payment category too.
 */
export function payeeMemory(state: BudgetState): Map<string, PayeeInfo> {
  const archived = archivedCategoryIds(state);
  const memory = new Map<string, PayeeInfo & { categoryDate: { outflow: string; inflow: string } }>();
  for (const t of state.transactions) {
    if ((t.transferAccountId !== null && t.categoryId === null) || !t.payee.trim()) continue;
    const key = payeeKey(t.payee);
    const kind = t.amount > 0 ? 'inflow' : 'outflow';
    const info = memory.get(key) ?? { name: '', count: 0, lastDate: '', kind, categoryFor: { outflow: null, inflow: null }, categoryDate: { outflow: '', inflow: '' } };
    info.count += 1;
    // Later date wins; on the same day the later entry in the list (entered or imported later) wins.
    if (t.date >= info.lastDate) Object.assign(info, { name: t.payee.trim(), lastDate: t.date, kind });
    if (t.categoryId !== null && !t.splits?.length && !archived.has(t.categoryId) && t.date >= info.categoryDate[kind]) {
      info.categoryFor[kind] = t.categoryId;
      info.categoryDate[kind] = t.date;
    }
    memory.set(key, info);
  }
  return new Map([...memory].map(([key, { categoryDate: _, ...info }]) => [key, info]));
}

/** The remembered category for money out (or in, for a positive amount), or null. */
export function suggestCategory(memory: Map<string, PayeeInfo>, payee: string, amount: number): string | null {
  return memory.get(payeeKey(payee))?.categoryFor[amount > 0 ? 'inflow' : 'outflow'] ?? null;
}

/** The category to fill in for the payee's last kind of transaction, if it still exists. */
export function rememberedCategory(state: BudgetState, info: PayeeInfo | undefined): string | null {
  const id = info?.categoryFor[info.kind] ?? null;
  return id !== null && state.categories.some((c) => c.id === id) ? id : null;
}

/**
 * Known payees for what was typed: names starting with it first, then names containing it; within each, the most
 * used and then the most recent first. Nothing for an empty field or when the only match is what was typed.
 */
export function suggestPayees(memory: Map<string, PayeeInfo>, typed: string, limit = 6): PayeeInfo[] {
  const q = payeeKey(typed);
  if (!q) return [];
  const rank = (a: PayeeInfo, b: PayeeInfo) => b.count - a.count || b.lastDate.localeCompare(a.lastDate) || a.name.localeCompare(b.name);
  const all = [...memory.entries()];
  const starts = all.filter(([k]) => k.startsWith(q)).map(([, v]) => v).sort(rank);
  const contains = all.filter(([k]) => !k.startsWith(q) && k.includes(q)).map(([, v]) => v).sort(rank);
  const found = [...starts, ...contains].slice(0, limit);
  return found.length === 1 && payeeKey(found[0]!.name) === q ? [] : found;
}

/**
 * What choosing a known payee fills into the entry form: the kind and category from last time. Only into an empty
 * category: a category the user already chose is never replaced, and transfers and splits are left alone.
 */
export function fillFromPayee(
  state: BudgetState,
  form: { kind: 'outflow' | 'inflow' | 'transfer'; categoryId: string | null; split: boolean },
  payee: PayeeInfo,
): { kind?: 'outflow' | 'inflow'; categoryId?: string } {
  if (form.kind === 'transfer' || form.split || form.categoryId) return {};
  const categoryId = rememberedCategory(state, payee);
  return {
    ...(payee.kind !== form.kind ? { kind: payee.kind } : {}),
    ...(categoryId ? { categoryId } : {}),
  };
}
