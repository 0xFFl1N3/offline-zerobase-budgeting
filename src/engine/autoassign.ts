import { archivedCategoryIds, categoryAssigned, categoryAvailable, goalProgress, readyToAssign } from './budget.ts';
import { addMonths } from './months.ts';
import type { BudgetState, Cents, Month } from './types.ts';

export interface AutoAssignStep {
  categoryId: string;
  /** Money to add on top of what is already assigned this month. */
  add: Cents;
}

export interface AutoAssignPlan {
  steps: AutoAssignStep[];
  total: Cents;
  /** Ready to Assign after applying the plan; negative means more is assigned than is available. */
  readyAfter: Cents;
}

/**
 * What it takes to fund every goal this month: for each active category with a goal that still needs money,
 * the amount goalProgress says is needed. Nothing is ever taken away from a category.
 */
export function autoAssignPlan(state: BudgetState, month: Month): AutoAssignPlan {
  const archived = archivedCategoryIds(state);
  const steps: AutoAssignStep[] = [];
  for (const category of state.categories) {
    if (archived.has(category.id)) continue;
    const goal = state.goals.find((g) => g.categoryId === category.id);
    if (!goal) continue;
    const add = goalProgress(state, goal, month).neededThisMonth;
    if (add > 0) steps.push({ categoryId: category.id, add });
  }
  const total = steps.reduce((sum, s) => sum + s.add, 0);
  return { steps, total, readyAfter: readyToAssign(state, month) - total };
}

/** The ways Auto-assign can fill categories. */
export type AssignKind = 'goals' | 'overspending' | 'lastMonth';
export const ASSIGN_KINDS: AssignKind[] = ['goals', 'overspending', 'lastMonth'];

/** A plan adding `add(category)` to each active category where that is more than zero. */
function planBy(state: BudgetState, month: Month, add: (categoryId: string) => Cents): AutoAssignPlan {
  const archived = archivedCategoryIds(state);
  const steps = state.categories
    .filter((c) => !archived.has(c.id))
    .map((c) => ({ categoryId: c.id, add: add(c.id) }))
    .filter((step) => step.add > 0);
  const total = steps.reduce((sum, step) => sum + step.add, 0);
  return { steps, total, readyAfter: readyToAssign(state, month) - total };
}

/** What it takes to bring every category that is in the minus this month back to zero. */
export const overspendingPlan = (state: BudgetState, month: Month) =>
  planBy(state, month, (id) => Math.max(0, -categoryAvailable(state, id, month)));

/** Categories with nothing assigned this month get what was assigned to them last month. */
export const lastMonthPlan = (state: BudgetState, month: Month) =>
  planBy(state, month, (id) => (categoryAssigned(state, id, month) === 0 ? Math.max(0, categoryAssigned(state, id, addMonths(month, -1))) : 0));

export function assignPlan(state: BudgetState, month: Month, kind: AssignKind): AutoAssignPlan {
  if (kind === 'overspending') return overspendingPlan(state, month);
  if (kind === 'lastMonth') return lastMonthPlan(state, month);
  return autoAssignPlan(state, month);
}

/** The Assigned amounts the plan results in, for storing. */
export const planAssignments = (state: BudgetState, plan: AutoAssignPlan, month: Month) =>
  plan.steps.map((s) => ({ categoryId: s.categoryId, assigned: categoryAssigned(state, s.categoryId, month) + s.add }));
