import { useState, type FormEvent } from 'react';
import { parseMoney } from '../../engine/money.ts';
import type { Category, Goal, GoalType } from '../../engine/types.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { buildGoal, goalToForm } from './buildGoal.ts';

const TYPE_LABELS: Record<GoalType, string> = {
  target_balance: 'Save up to an amount',
  monthly_amount: 'Assign a set amount every month',
};

interface Props {
  category: Category;
  goal: Goal | undefined;
  onClose: () => void;
}

export function GoalEditor({ category, goal, onClose }: Props) {
  const saveGoal = useBudgetStore((s) => s.saveGoal);
  const removeGoal = useBudgetStore((s) => s.removeGoal);

  const initial = goal ? goalToForm(goal) : { type: 'target_balance' as GoalType, amount: 0, targetDate: '' };
  const [type, setType] = useState<GoalType>(initial.type);
  const [amountText, setAmountText] = useState(initial.amount ? (initial.amount / 100).toFixed(2) : '');
  const [targetDate, setTargetDate] = useState(initial.targetDate);
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const amount = parseMoney(amountText);
    if (amount === null) return setError('Enter a valid amount, e.g. 1000.');
    const result = buildGoal({ type, amount, targetDate }, category.id, goal?.id ?? crypto.randomUUID());
    if (!result.ok) return setError(result.error);
    void saveGoal(result.goal);
    onClose();
  };

  const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';
  const label = 'text-xs font-medium text-slate-600';
  return (
    <form onSubmit={submit} className="mx-4 mb-2 ml-8 flex flex-wrap items-end gap-3 rounded bg-slate-50 p-3">
      <span className="w-full text-sm font-medium">Goal for {category.name}</span>
      <label className={label}>
        Type
        <select value={type} onChange={(e) => setType(e.target.value as GoalType)} className={`${field} mt-1 block`}>
          {(Object.keys(TYPE_LABELS) as GoalType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        {type === 'monthly_amount' ? 'Per month' : 'Target amount'}
        <input
          autoFocus
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          className={`${field} mt-1 block w-32 text-right tabular-nums`}
        />
      </label>
      {type !== 'monthly_amount' && (
        <label className={label}>
          By month (optional)
          <input type="month" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={`${field} mt-1 block`} />
        </label>
      )}
      <button type="submit" className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700">Save goal</button>
      {goal && (
        <button
          type="button"
          onClick={() => {
            void removeGoal(category.id);
            onClose();
          }}
          className="text-sm text-red-600 hover:underline"
        >
          Remove goal
        </button>
      )}
      <button type="button" onClick={onClose} className="text-sm text-slate-600 hover:underline">Cancel</button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
