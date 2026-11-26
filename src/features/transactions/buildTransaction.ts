import type { Cents, Transaction } from '../../engine/types.ts';

export type TxKind = 'outflow' | 'inflow' | 'transfer';

/** What the entry form holds. `amount` is a positive magnitude; `kind` decides the sign. */
export interface TxForm {
  kind: TxKind;
  date: string;
  accountId: string;
  payee: string;
  categoryId: string | null;
  transferAccountId: string | null;
  memo: string;
  amount: Cents;
  /** Outflow only: the parts of a split, amounts as positive magnitudes. null or absent = one category. */
  splits?: { categoryId: string | null; amount: Cents }[] | null;
}

export type BuildResult = { ok: true; transaction: Transaction } | { ok: false; error: string };

export function buildTransaction(form: TxForm, id: string): BuildResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.date)) return { ok: false, error: 'Pick a date.' };
  if (!form.accountId) return { ok: false, error: 'Pick an account.' };
  if (!(form.amount > 0)) return { ok: false, error: 'Enter an amount greater than zero.' };

  if (form.kind === 'transfer') {
    if (!form.transferAccountId) return { ok: false, error: 'Pick the account to transfer to.' };
    if (form.transferAccountId === form.accountId) return { ok: false, error: 'Choose two different accounts.' };
    return {
      ok: true,
      transaction: {
        id,
        accountId: form.accountId,
        date: form.date,
        payee: form.payee.trim() || 'Transfer',
        categoryId: null,
        memo: form.memo.trim(),
        amount: -form.amount,
        transferAccountId: form.transferAccountId,
      },
    };
  }

  if (form.kind === 'outflow' && form.splits) {
    if (form.splits.length < 2) return { ok: false, error: 'A split needs at least two parts.' };
    if (form.splits.some((s) => !s.categoryId)) return { ok: false, error: 'Pick a category for every part of the split.' };
    if (form.splits.some((s) => !(s.amount > 0))) return { ok: false, error: 'Give every part an amount greater than zero.' };
    if (form.splits.reduce((sum, s) => sum + s.amount, 0) !== form.amount) {
      return { ok: false, error: 'The parts of the split must add up to the total amount.' };
    }
    return {
      ok: true,
      transaction: {
        id,
        accountId: form.accountId,
        date: form.date,
        payee: form.payee.trim(),
        categoryId: null,
        memo: form.memo.trim(),
        amount: -form.amount,
        transferAccountId: null,
        splits: form.splits.map((s) => ({ categoryId: s.categoryId as string, amount: -s.amount })),
      },
    };
  }

  if (form.kind === 'outflow' && !form.categoryId) return { ok: false, error: 'Pick a category for this outflow.' };

  return {
    ok: true,
    transaction: {
      id,
      accountId: form.accountId,
      date: form.date,
      payee: form.payee.trim(),
      categoryId: form.categoryId,
      memo: form.memo.trim(),
      amount: form.kind === 'outflow' ? -form.amount : form.amount,
      transferAccountId: null,
    },
  };
}

export function toForm(t: Transaction): TxForm {
  return {
    kind: t.transferAccountId ? 'transfer' : t.amount < 0 ? 'outflow' : 'inflow',
    date: t.date,
    accountId: t.accountId,
    payee: t.payee,
    categoryId: t.categoryId,
    transferAccountId: t.transferAccountId,
    memo: t.memo,
    amount: Math.abs(t.amount),
    splits: t.splits ? t.splits.map((s) => ({ categoryId: s.categoryId, amount: Math.abs(s.amount) })) : null,
  };
}
