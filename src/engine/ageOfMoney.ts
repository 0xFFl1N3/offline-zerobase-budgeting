import type { BudgetState, Month } from './types.ts';

/** How many of the most recent outflows are averaged. */
export const AGE_OUTFLOWS = 10;

const DAY = 86_400_000;
const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

/**
 * Age of money: on average, how many days the money spent in the last ten outflows had been in the accounts.
 *
 * Money is spent oldest first: every inflow (income, refunds, and each account's opening balance, dated at the
 * account's first transaction) joins a queue, and every outflow takes from the front. An outflow's age is the
 * average age of the money it took, weighted by amount; spending more than has come in counts as 0 days.
 * Only money in budget accounts counts: transfers between them are ignored, a debt payment is an outflow,
 * borrowed money arriving from a debt is an inflow, and what happens inside a debt account is ignored.
 * Transactions after `asOf` are ignored.
 * Returns null until there are ten outflows.
 */
export function ageOfMoney(state: BudgetState, asOf: string): number | null {
  return averageOfLast(datedAges(state, asOf).map((a) => a.age));
}

function averageOfLast(ages: number[]): number | null {
  if (ages.length < AGE_OUTFLOWS) return null;
  const last = ages.slice(-AGE_OUTFLOWS);
  return Math.round(last.reduce((t, a) => t + a, 0) / last.length);
}

/** Age of money at the end of each month (or on `today` for the current month); null where there was too little history. */
export function ageHistory(state: BudgetState, months: Month[], today: string): { month: Month; value: number | null }[] {
  const ages = datedAges(state, today);
  return months.map((month) => {
    const end = `${month}-31` < today ? `${month}-31` : today;
    return { month, value: averageOfLast(ages.filter((a) => a.date <= end).map((a) => a.age)) };
  });
}

/** The age (days) of every outflow up to `asOf`, oldest first. */
export function outflowAges(state: BudgetState, asOf: string): number[] {
  return datedAges(state, asOf).map((a) => a.age);
}

function datedAges(state: BudgetState, asOf: string): { date: string; age: number }[] {
  type Event = { date: string; amount: number; order: number };
  const events: Event[] = [];
  const firstDate = new Map<string, string>();
  const debt = new Set(state.accounts.filter((a) => a.type === 'debt').map((a) => a.id));
  const inBudget = (id: string | null) => id !== null && !debt.has(id);
  state.transactions.forEach((t, order) => {
    if (t.date > asOf) return;
    for (const id of [t.accountId, t.transferAccountId]) {
      if (inBudget(id) && (!firstDate.has(id!) || t.date < firstDate.get(id!)!)) firstDate.set(id!, t.date);
    }
    // What the transaction does to the money in budget accounts.
    let amount = 0;
    if (t.transferAccountId === null) amount = inBudget(t.accountId) ? t.amount : 0;
    else if (inBudget(t.accountId) !== inBudget(t.transferAccountId)) amount = inBudget(t.accountId) ? t.amount : -t.amount;
    if (amount === 0) return;
    events.push({ date: t.date, amount, order });
  });
  for (const account of state.accounts) {
    if (debt.has(account.id)) continue;
    const date = firstDate.get(account.id);
    if (date && account.openingBalance > 0) events.push({ date, amount: account.openingBalance, order: -1 });
  }
  // By date; on the same day, money comes in before it goes out.
  events.sort((a, b) => a.date.localeCompare(b.date) || Number(a.amount < 0) - Number(b.amount < 0) || a.order - b.order);

  const queue: { date: string; left: number }[] = [];
  let head = 0;
  const ages: { date: string; age: number }[] = [];
  for (const e of events) {
    if (e.amount > 0) {
      queue.push({ date: e.date, left: e.amount });
      continue;
    }
    let need = -e.amount;
    let weighted = 0;
    while (need > 0 && head < queue.length) {
      const inflow = queue[head]!;
      const take = Math.min(need, inflow.left);
      weighted += take * days(inflow.date, e.date);
      inflow.left -= take;
      need -= take;
      if (inflow.left === 0) head++;
    }
    ages.push({ date: e.date, age: weighted / -e.amount });
  }
  return ages;
}
