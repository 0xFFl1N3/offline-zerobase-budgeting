import { useState } from 'react';
import { toAmountInput } from '../../engine/money.ts';
import { parseAmountInput } from '../../engine/amountInput.ts';
import { REPEAT_MONTHS, type Goal, type RepeatMonths } from '../../engine/types.ts';
import { t, type MessageKey } from '../../i18n/i18n.ts';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';
import { SumHint } from '../../components/SumHint.tsx';
import { buildGoal, GOAL_KINDS, type GoalForm, type GoalKind } from './buildGoal.ts';

const KIND_LABELS: Record<GoalKind, MessageKey> = {
  keep: 'goal.typeKeep',
  save_by: 'goal.typeSaveBy',
  monthly: 'goal.typeMonthly',
};
const AMOUNT_LABELS: Record<GoalKind, MessageKey> = {
  keep: 'goal.keepAmount',
  save_by: 'goal.target',
  monthly: 'goal.perMonth',
};

export const EMPTY_GOAL_FORM: GoalForm = { type: 'keep', amount: 0, targetDate: '', repeatMonths: null };

/** The goal's fields as the user types them, shared by the goal editor and "Add category". */
export function useGoalFields(initial: GoalForm = EMPTY_GOAL_FORM) {
  const [type, setType] = useState<GoalKind>(initial.type);
  const [amountText, setAmountText] = useState(initial.amount ? toAmountInput(initial.amount) : '');
  const [targetDate, setTargetDate] = useState(initial.targetDate);
  const [repeatMonths, setRepeatMonths] = useState<RepeatMonths | null>(initial.repeatMonths ?? null);

  /** The goal, or the text of what is wrong. */
  const build = (categoryId: string, id: string): { ok: true; goal: Goal } | { ok: false; error: string } => {
    const amount = parseAmountInput(amountText);
    if (amount === null) return { ok: false, error: t('goal.errorAmount') };
    const result = buildGoal({ type, amount, targetDate, repeatMonths }, categoryId, id);
    return result.ok ? result : { ok: false, error: t(result.error) };
  };

  const field = 'rounded border border-slate-300 bg-white px-2 py-1.5 text-sm';
  const label = 'text-xs font-medium text-slate-600';
  const fields = (
    <>
      <label className={`max-w-full ${label}`}>
        {t('goal.type')}
        <select value={type} onChange={(e) => setType(e.target.value as GoalKind)} className={`${field} mt-1 block max-w-full`}>
          {GOAL_KINDS.map((kind) => (
            <option key={kind} value={kind}>{t(KIND_LABELS[kind])}</option>
          ))}
        </select>
      </label>
      <label className={`relative ${label}`}>
        {t(AMOUNT_LABELS[type])}
        <input {...NO_AUTOFILL}
          autoFocus
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          inputMode="decimal"
          placeholder={t('common.amountPlaceholder')}
          className={`${field} mt-1 block w-32 text-right tabular-nums`}
        />
        <SumHint text={amountText} />
      </label>
      {type === 'save_by' && (
        <label className={label}>
          {t('goal.byMonth')}
          <input {...NO_AUTOFILL} type="month" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className={`${field} mt-1 block`} />
        </label>
      )}
      {type === 'save_by' && (
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
      {type === 'keep' && <p className="w-full text-xs text-slate-500">{t('goal.keepHint')}</p>}
    </>
  );
  return { fields, build };
}
