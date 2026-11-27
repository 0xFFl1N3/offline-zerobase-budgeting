/** All money values are integer cents. Months are 'YYYY-MM', dates are 'YYYY-MM-DD'. */
export type Month = string;
export type Cents = number;

/**
 * 'debt' is a loan or other money owed: outside the budget, its balance is negative while something is owed.
 * 'tracking' is money kept outside the budget (investments, a pension): it counts towards net worth only.
 */
export type AccountType = 'checking' | 'cash' | 'savings' | 'debt' | 'tracking';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: Cents;
  sortOrder: number;
  closed: boolean;
  /** Date ('YYYY-MM-DD') of the last finished reconciliation, if any. */
  lastReconciled?: string;
  /** Debt accounts: the category that payments are budgeted in. */
  paymentCategoryId?: string;
  /** Debt accounts: the agreed minimum monthly payment, if any. */
  minimumPayment?: Cents;
}

export interface CategoryGroup {
  id: string;
  name: string;
  sortOrder: number;
  archived: boolean;
}

export interface Category {
  id: string;
  groupId: string;
  name: string;
  sortOrder: number;
  archived: boolean;
}

export type GoalType = 'target_balance' | 'monthly_amount';

/** How often a goal with a date comes back: quarterly, twice a year or yearly. */
export type RepeatMonths = 3 | 6 | 12;
export const REPEAT_MONTHS: RepeatMonths[] = [3, 6, 12];

export interface Goal {
  id: string;
  categoryId: string;
  type: GoalType;
  /** target_balance */
  targetAmount?: Cents;
  /**
   * 'YYYY-MM'. Optional for target_balance: the due month, in which the category has to hold the amount; what is
   * needed is spread over the months until then.
   */
  targetDate?: Month;
  /** With a targetDate: the goal comes back every this many months, starting over after each due month. */
  repeatMonths?: RepeatMonths;
  /** monthly_amount */
  monthlyAmount?: Cents;
  /** Months ('YYYY-MM') in which the goal asks for nothing: "Pause this month". */
  pausedMonths?: Month[];
}

/** A goal for a category that does not exist yet. */
export type GoalDraft = Omit<Goal, 'id' | 'categoryId'>;

export interface MonthlyBudget {
  categoryId: string;
  month: Month;
  assigned: Cents;
}

/** One category's share of a split transaction. Same sign as the transaction's amount (negative for an outflow). */
export interface TransactionSplit {
  categoryId: string;
  amount: Cents;
}

export interface Transaction {
  id: string;
  accountId: string;
  date: string;
  payee: string;
  /**
   * null = income (inflow) or uncategorised. On a transfer, only set for a debt payment: money moves from a
   * budget account (accountId) to a debt account (transferAccountId) and is spent from this category.
   */
  categoryId: string | null;
  memo: string;
  /** Negative = outflow, positive = inflow. */
  amount: Cents;
  /** Set for a transfer: money moves from accountId to this account. */
  transferAccountId: string | null;
  /**
   * An outflow spread over several categories: at least two parts whose amounts add up to `amount`.
   * When set, `categoryId` is null.
   */
  splits?: TransactionSplit[];
  /** Whether the bank has this transaction (for accountId). Missing = uncleared. */
  cleared?: ClearedStatus;
  /** The same for the receiving account of a transfer, which is reconciled separately. */
  transferCleared?: ClearedStatus;
  /** Set on transactions imported from a bank file, so importing the same rows again can be recognised. */
  importId?: string;
  /** Imported while the bank still listed it as pending; a later import can update it once it is booked. */
  importPending?: boolean;
}

/** uncleared: not on the bank statement yet; cleared: ticked off; reconciled: locked in by a finished reconciliation. */
export type ClearedStatus = 'uncleared' | 'cleared' | 'reconciled';

export type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

/** The parts of a transaction that repeat: everything except its id and date. */
export type TransactionTemplate = Omit<Transaction, 'id' | 'date' | 'cleared' | 'transferCleared' | 'importId' | 'importPending'>;

/**
 * A transaction that repeats. Occurrence number n falls on `startDate` plus n periods; the first `handled`
 * occurrences have been booked or skipped, so the next one is number `handled`.
 */
export interface RecurringTransaction {
  id: string;
  template: TransactionTemplate;
  frequency: Frequency;
  startDate: string;
  handled: number;
  /** 'YYYY-MM-DD' of the last allowed occurrence, or null to repeat forever. */
  endDate: string | null;
  paused: boolean;
}

export interface BudgetState {
  accounts: Account[];
  groups: CategoryGroup[];
  categories: Category[];
  goals: Goal[];
  monthlyBudgets: MonthlyBudget[];
  transactions: Transaction[];
  recurring: RecurringTransaction[];
}

export interface GoalProgress {
  goalId: string;
  target: Cents;
  /** What counts toward the goal: Available balance (target goals) or this month's assigned (monthly goal). */
  current: Cents;
  /** 0 to 100, one decimal. */
  percent: number;
  /** How much more to assign this month to stay on track. */
  neededThisMonth: Cents;
  /** Goals with a date: the due month aimed at in the month shown (for a repeating goal, the next one). */
  dueMonth?: Month;
  /** A one-time goal whose due month has passed: it is met or not, and the user decides what comes next. */
  pastDue?: true;
  /** Paused for this month ("Pause this month"): it asks for nothing. */
  paused?: true;
}
