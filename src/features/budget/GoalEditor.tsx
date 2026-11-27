import type { Category, Goal } from '../../engine/types.ts';
import { goalPaused } from '../../engine/budget.ts';
import { t } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { goalToForm } from './buildGoal.ts';
import { EMPTY_GOAL_FORM, useGoalFields } from './GoalFields.tsx';
import { useAction } from '../errors/useAction.ts';
import { Form } from '../../components/Form.tsx';

interface Props {
  category: Category;
  goal: Goal | undefined;
  onClose: () => void;
  /** Start from the goal's amount with no month (a new round after a past due date). */
  fresh?: boolean;
}

export function GoalEditor({ category, goal, onClose, fresh = false }: Props) {
  const saveGoal = useBudgetStore((s) => s.saveGoal);
  const removeGoal = useBudgetStore((s) => s.removeGoal);
  const pauseGoal = useBudgetStore((s) => s.pauseGoal);
  const month = useBudgetStore((s) => s.month);
  const paused = goal ? goalPaused(goal, month) : false;

  // A fresh goal after a past due date keeps the amount and asks for a new month.
  const initial = goal ? { ...goalToForm(goal), ...(fresh ? { targetDate: '', repeatMonths: null } : {}) } : EMPTY_GOAL_FORM;
  const { fields, build } = useGoalFields(initial);
  const { run, error, setError } = useAction();

  const submit = () => {
    const result = build(category.id, goal?.id ?? crypto.randomUUID());
    if (!result.ok) return setError(result.error);
    // Changing the goal keeps the months it is paused in.
    const next = goal?.pausedMonths ? { ...result.goal, pausedMonths: goal.pausedMonths } : result.goal;
    void run(() => saveGoal(next)).then((ok) => ok && onClose());
  };

  return (
    <Form onSubmit={submit} className="mx-4 mb-2 ml-8 flex flex-wrap items-end gap-3 rounded bg-slate-50 p-3">
      <span className="w-full text-sm font-medium">{t('goal.for', { name: category.name })}</span>
      {fields}
      <button type="submit" className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700">{t('goal.save')}</button>
      {goal && (
        <button
          type="button"
          onClick={() => {
            void pauseGoal(category.id, !paused);
            onClose();
          }}
          className="text-sm text-sky-700 hover:underline"
        >
          {t(paused ? 'goal.resumeMonth' : 'goal.pauseMonth')}
        </button>
      )}
      {goal && (
        <button
          type="button"
          onClick={() => {
            void removeGoal(category.id);
            onClose();
          }}
          className="text-sm text-red-600 hover:underline"
        >
          {t('goal.remove')}
        </button>
      )}
      <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:underline">{t('common.cancel')}</button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </Form>
  );
}
