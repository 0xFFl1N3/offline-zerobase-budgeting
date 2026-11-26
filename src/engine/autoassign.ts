import { archivedCategoryIds, categoryAssigned, goalProgress, readyToAssign } from './budget.ts';
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

/** The Assigned amounts the plan results in, for storing. */
export const planAssignments = (state: BudgetState, plan: AutoAssignPlan, month: Month) =>
  plan.steps.map((s) => ({ categoryId: s.categoryId, assigned: categoryAssigned(state, s.categoryId, month) + s.add }));
