/**
 * What the app remembers about payees, worked out from the transactions (nothing is stored for it), so it is
 * right after an import, an undo or a restore.
 */
import { archivedCategoryIds } from './budget.ts';
import type { BudgetState, Transaction } from './types.ts';

export interface PayeeInfo {
  /** As written the last time it was used. */
  name: string;
  /** How often it was used. */
  count: number;
  lastDate: string;
  /** The category of the last transaction with this payee; null for income, splits and uncategorized ones. */
  categoryId: string | null;
  /** Whether the last transaction was money in or out. */
  kind: 'inflow' | 'outflow';
}

/** Payees are the same when they only differ in case or spacing. */
export const payeeKey = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

/** Every payee used in a non-transfer transaction, by payeeKey. */
export function payeeMemory(state: BudgetState): Map<string, PayeeInfo> {
  const memory = new Map<string, PayeeInfo>();
  const latest = new Map<string, Transaction>();
  for (const t of state.transactions) {
    if (t.transferAccountId !== null || !t.payee.trim()) continue;
    const key = payeeKey(t.payee);
    const seen = latest.get(key);
    // Later date wins; on the same day the later entry in the list (entered or imported later) wins.
    if (!seen || t.date >= seen.date) latest.set(key, t);
    const info = memory.get(key);
    memory.set(key, { ...(info ?? emptyInfo), count: (info?.count ?? 0) + 1 });
  }
  for (const [key, t] of latest) {
    memory.set(key, {
      name: t.payee.trim(),
      count: memory.get(key)!.count,
      lastDate: t.date,
      categoryId: t.splits?.length ? null : t.categoryId,
      kind: t.amount > 0 ? 'inflow' : 'outflow',
    });
  }
  return memory;
}

const emptyInfo: PayeeInfo = { name: '', count: 0, lastDate: '', categoryId: null, kind: 'outflow' };

/** The remembered category if it can still be used (not archived, not deleted), else null. */
export function rememberedCategory(state: BudgetState, info: PayeeInfo | undefined): string | null {
  if (!info?.categoryId) return null;
  const archived = archivedCategoryIds(state);
  return state.categories.some((c) => c.id === info.categoryId) && !archived.has(info.categoryId) ? info.categoryId : null;
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
