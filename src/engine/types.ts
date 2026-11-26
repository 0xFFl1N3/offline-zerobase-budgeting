/** All money values are integer cents. Months are 'YYYY-MM', dates are 'YYYY-MM-DD'. */
export type Month = string;
export type Cents = number;

export type AccountType = 'checking' | 'cash' | 'savings';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: Cents;
  sortOrder: number;
  closed: boolean;
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

export interface Goal {
  id: string;
  categoryId: string;
  type: GoalType;
  /** target_balance */
  targetAmount?: Cents;
  /** 'YYYY-MM'. Optional for target_balance: if set, progress is paced over the months left. */
  targetDate?: Month;
  /** monthly_amount */
  monthlyAmount?: Cents;
}

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
  /** null = income (inflow) or uncategorised. Ignored when transferAccountId is set. */
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
}

export interface BudgetState {
  accounts: Account[];
  groups: CategoryGroup[];
  categories: Category[];
  goals: Goal[];
  monthlyBudgets: MonthlyBudget[];
  transactions: Transaction[];
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
}
