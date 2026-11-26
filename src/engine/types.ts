/** All money values are integer cents. Months are 'YYYY-MM', dates are 'YYYY-MM-DD'. */
export type Month = string;
export type Cents = number;

export type AccountType = 'checking' | 'cash' | 'savings';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalance: Cents;
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

export type GoalType = 'target_balance' | 'monthly_amount' | 'target_by_date';

export interface Goal {
  id: string;
  categoryId: string;
  type: GoalType;
  /** target_balance and target_by_date */
  targetAmount?: Cents;
  /** 'YYYY-MM'. Required for target_by_date, optional for target_balance. */
  targetDate?: Month;
  /** monthly_amount */
  monthlyAmount?: Cents;
}

export interface MonthlyBudget {
  categoryId: string;
  month: Month;
  assigned: Cents;
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
