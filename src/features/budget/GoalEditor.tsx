import { useState } from 'react';
import { parseMoney, toAmountInput } from '../../engine/money.ts';
import { REPEAT_MONTHS, type Category, type Goal, type GoalType, type RepeatMonths } from '../../engine/types.ts';
import { t, type MessageKey } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { buildGoal, goalToForm } from './buildGoal.ts';
import { useAction } from '../errors/useAction.ts';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';
import { Form } from '../../components/Form.tsx';

const TYPE_LABELS: Record<GoalType, MessageKey> = {
  target_balance: 'goal.typeTarget',
  monthly_amount: 'goal.typeMonthly',
};

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

  // A fresh goal after a past due date keeps the amount and asks for a new month.
  const initial = goal ? { ...goalToForm(goal), ...(fresh ? { targetDate: '', repeatMonths: null } : {}) } : { type: 'target_balance' as GoalType, amount: 0, targetDate: '', repeatMonths: null };
  const [type, setType] = useState<GoalType>(initial.type);
  const [amountText, setAmountText] = useState(initial.amount ? toAmountInput(initial.amount) : '');
  const [targetDate, setTargetDate] = useState(initial.targetDate);
  const [repeatMonths, setRepeatMonths] = useState<RepeatMonths | null>(initial.repeatMonths ?? null);
  const { run, error, setError } = useAction();

  const submit = () => {
    const amount = parseMoney(amountText);
    if (amount === null) return setError(t('goal.errorAmount'));
    const result = buildGoal({ type, amount, targetDate, repeatMonths }, category.id, goal?.id ?? crypto.randomUUID());
    if (!result.ok) return setError(t(result.error));
    const next = result.goal;
    void run(() => saveGoal(next)).then((ok) => ok && onClose());
  };

  const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';
  const label = 'text-xs font-medium text-slate-600';
  return (
    <Form onSubmit={submit} className="mx-4 mb-2 ml-8 flex flex-wrap items-end gap-3 rounded bg-slate-50 p-3">
      <span className="w-full text-sm font-medium">{t('goal.for', { name: category.name })}</span>
      <label className={label}>
        {t('goal.type')}
        <select value={type} onChange={(e) => setType(e.target.value as GoalType)} className={`${field} mt-1 block`}>
          {(Object.keys(TYPE_LABELS) as GoalType[]).map((type) => (
            <option key={type} value={type}>{t(TYPE_LABELS[type])}</option>
          ))}
        </select>
      </label>
      <label className={label}>
        {type === 'monthly_amount' ? t('goal.perMonth') : t('goal.target')}
        <input {...NO_AUTOFILL}
          autoFocus
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          inputMode="decimal"
          placeholder={t('common.amountPlaceholder')}
          className={`${field} mt-1 block w-32 text-right tabular-nums`}
        />
      </label>
      {type !== 'monthly_amount' && (
        <label className={label}>
          {t('goal.byMonth')}
          <input {...NO_AUTOFILL} type="month" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={`${field} mt-1 block`} />
        </label>
      )}
      {type !== 'monthly_amount' && targetDate !== '' && (
        <label className={label}>
          {t('goal.repeat')}
          <select
            value={repeatMonths ?? ''}
            onChange={(e) => setRepeatMonths(e.target.value ? (Number(e.target.value) as RepeatMonths) : null)}
            className={`${field} mt-1 block`}
          >
            <option value="">{t('goal.repeatOnce')}</option>
            {REPEAT_MONTHS.map((n) => (
              <option key={n} value={n}>{t(`goal.repeatEvery${n}`)}</option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700">{t('goal.save')}</button>
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
