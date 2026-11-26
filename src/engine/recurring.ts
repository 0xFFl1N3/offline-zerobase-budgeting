import { addDays, addMonthsClamped } from './dates.ts';
import type { Frequency, RecurringTransaction, Transaction } from './types.ts';

export const FREQUENCIES: Frequency[] = ['weekly', 'biweekly', 'monthly', 'yearly'];

/** The date of occurrence number `index` (0 = the start date). Always counted from the start, so a 31st never drifts to the 28th. */
export function occurrenceDate(startDate: string, frequency: Frequency, index: number): string {
  switch (frequency) {
    case 'weekly':
      return addDays(startDate, 7 * index);
    case 'biweekly':
      return addDays(startDate, 14 * index);
    case 'monthly':
      return addMonthsClamped(startDate, index);
    case 'yearly':
      return addMonthsClamped(startDate, 12 * index);
  }
}

/** The next occurrence that has not been booked or skipped, or null once it falls after the end date. */
export function nextDate(rec: RecurringTransaction): string | null {
  const date = occurrenceDate(rec.startDate, rec.frequency, rec.handled);
  return rec.endDate !== null && date > rec.endDate ? null : date;
}

const MAX_BACKLOG = 1000;

/** Dates of occurrences that are due on `today` and not handled yet, oldest first. Paused templates have none. */
export function dueDates(rec: RecurringTransaction, today: string): string[] {
  if (rec.paused) return [];
  const dates: string[] = [];
  for (let i = rec.handled; dates.length < MAX_BACKLOG; i++) {
    const date = occurrenceDate(rec.startDate, rec.frequency, i);
    if (date > today || (rec.endDate !== null && date > rec.endDate)) break;
    dates.push(date);
  }
  return dates;
}

export interface DueItem {
  recurringId: string;
  /** The oldest unhandled occurrence. */
  date: string;
  /** How many more occurrences are due after this one. */
  moreAfter: number;
}

/** One entry per template that has something due: its oldest occurrence, with a count of the rest. Oldest first. */
export function dueItems(recurring: RecurringTransaction[], today: string): DueItem[] {
  const items: DueItem[] = [];
  for (const rec of recurring) {
    const dates = dueDates(rec, today);
    if (dates.length > 0) items.push({ recurringId: rec.id, date: dates[0] as string, moreAfter: dates.length - 1 });
  }
  return items.sort((a, b) => (a.date === b.date ? a.recurringId.localeCompare(b.recurringId) : a.date < b.date ? -1 : 1));
}

const fromTemplate = (rec: RecurringTransaction, date: string, id: string, amount?: number): Transaction => {
  const t = rec.template;
  // A different amount only makes sense for a transaction in one piece; the sign stays the template's.
  const useAmount = amount !== undefined && !t.splits && amount > 0 ? Math.sign(t.amount) * Math.abs(amount) : t.amount;
  return { ...t, id, date, amount: useAmount, ...(t.splits && { splits: t.splits.map((s) => ({ ...s })) }) };
};

/** Books the next occurrence as a real transaction and moves the template on. `amount` (positive) overrides the usual amount. */
export function bookNext(rec: RecurringTransaction, id: string, amount?: number): { transaction: Transaction; recurring: RecurringTransaction } {
  const date = nextDate(rec);
  if (date === null) throw new Error('This recurring transaction has ended.');
  return { transaction: fromTemplate(rec, date, id, amount), recurring: { ...rec, handled: rec.handled + 1 } };
}

/** Skips the next occurrence without booking anything. */
export const skipNext = (rec: RecurringTransaction): RecurringTransaction => ({ ...rec, handled: rec.handled + 1 });

const templateOf = (t: Transaction): RecurringTransaction['template'] => {
  const { id: _id, date: _date, splits, cleared: _c, transferCleared: _tc, importId: _i, importPending: _ip, ...rest } = t;
  return { ...rest, ...(splits && { splits: splits.map((s) => ({ ...s })) }) };
};

function checkEnd(startDate: string, endDate: string | null) {
  if (endDate !== null && endDate < startDate) throw new Error('The end date cannot be before the first date.');
}

/**
 * Starts a recurring series from a transaction the user has just entered. If its date has come it is booked now
 * (the series then continues after it); if it lies in the future it becomes the first due occurrence instead.
 */
export function startRecurring(
  t: Transaction,
  frequency: Frequency,
  endDate: string | null,
  today: string,
  recurringId: string,
): { transaction: Transaction | null; recurring: RecurringTransaction } {
  checkEnd(t.date, endDate);
  const booked = t.date <= today;
  return {
    transaction: booked ? t : null,
    recurring: { id: recurringId, template: templateOf(t), frequency, startDate: t.date, handled: booked ? 1 : 0, endDate, paused: false },
  };
}

/** Makes an existing transaction the first occurrence of a new series. */
export function recurringFrom(t: Transaction, frequency: Frequency, endDate: string | null, recurringId: string): RecurringTransaction {
  checkEnd(t.date, endDate);
  return { id: recurringId, template: templateOf(t), frequency, startDate: t.date, handled: 1, endDate, paused: false };
}

export interface RecurringChanges {
  payee?: string;
  memo?: string;
  /** Positive magnitude; ignored for splits. */
  amount?: number;
  frequency?: Frequency;
  endDate?: string | null;
}

/** Edits a template. Changing the frequency restarts the sequence from the next occurrence so no dates are lost or repeated. */
export function updateRecurring(rec: RecurringTransaction, changes: RecurringChanges): RecurringTransaction {
  let next = { ...rec, template: { ...rec.template } };
  if (changes.payee !== undefined) next.template.payee = changes.payee.trim();
  if (changes.memo !== undefined) next.template.memo = changes.memo.trim();
  if (changes.amount !== undefined && !rec.template.splits) {
    if (!(changes.amount > 0)) throw new Error('Enter an amount greater than zero.');
    next.template.amount = Math.sign(rec.template.amount) * changes.amount;
  }
  if (changes.frequency !== undefined && changes.frequency !== rec.frequency) {
    const anchor = occurrenceDate(rec.startDate, rec.frequency, rec.handled);
    next = { ...next, frequency: changes.frequency, startDate: anchor, handled: 0 };
  }
  if (changes.endDate !== undefined) next.endDate = changes.endDate;
  checkEnd(occurrenceDate(next.startDate, next.frequency, next.handled), next.endDate);
  return next;
}

/** Pauses or resumes. Resuming skips the occurrences that fell into the pause, so nothing old suddenly shows up as due. */
export function setRecurringPaused(rec: RecurringTransaction, paused: boolean, today: string): RecurringTransaction {
  if (paused || !rec.paused) return { ...rec, paused };
  let handled = rec.handled;
  for (let i = 0; i < MAX_BACKLOG && occurrenceDate(rec.startDate, rec.frequency, handled) < today; i++) handled++;
  return { ...rec, paused: false, handled };
}
