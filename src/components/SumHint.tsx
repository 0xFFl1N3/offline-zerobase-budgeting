import { isSum, parseAmountInput } from '../engine/amountInput.ts';
import { formatMoney } from '../engine/money.ts';
import type { Cents } from '../engine/types.ts';
import { t } from '../i18n/i18n.ts';
import { useBudgetStore } from '../store/budgetStore.ts';

/**
 * While a sum is typed into an amount field, shows its result under the field ("= 102,69 €"), or that it is not a
 * valid amount yet. Nothing for a plain amount. Put inside a `relative` element; it floats, so nothing moves.
 */
export function SumHint({ text, current = null }: { text: string; current?: Cents | null }) {
  const currency = useBudgetStore((s) => s.currency);
  if (!isSum(text, current)) return null;
  const value = parseAmountInput(text, current);
  return (
    <span
      aria-live="polite"
      className={`pointer-events-none absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-xs font-medium tabular-nums shadow ring-1 ring-slate-200 ${value === null ? 'text-amber-700' : 'text-slate-700'}`}
    >
      {value === null ? t('common.notAnAmount') : `= ${formatMoney(value, currency)}`}
    </span>
  );
}
