import { formatMoney, formatPercent, type Currency } from '../../engine/money.ts';
import type { TopPayees as TopPayeesData } from '../../engine/reports.ts';
import { NO_PAYEE } from '../../engine/reports.ts';
import { t } from '../../i18n/i18n.ts';
import { SERIES_COLORS } from './colors.ts';

export function TopPayees({ data, currency }: { data: TopPayeesData; currency: Currency }) {
  const fmt = (c: number) => formatMoney(c, currency);
  const max = data.rows[0]?.amount ?? 0;
  const pct = (c: number) => (data.total > 0 ? Math.round((c / data.total) * 1000) / 10 : 0);
  return (
    <article className="rounded-lg bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold">{t('analytics.topPayees')}</h3>
      <p className="text-xs text-slate-500">{t('analytics.topPayeesHint')}</p>
      {data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">{t('analytics.noSpending')}</p>
      ) : (
        <>
          <ol className="mt-4 space-y-2 text-sm">
            {data.rows.map((r, i) => (
              // Desktop: rank, name, bar, amount, share. Phones: rank, name and amount, with bar and share on a second line.
              <li key={r.label} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 md:grid-cols-[1.5rem_minmax(0,9rem)_1fr_auto_6.5rem]">
                <span className="text-right text-xs text-slate-500 tabular-nums">{i + 1}</span>
                <span className="truncate" title={r.label}>{r.label === NO_PAYEE ? t('recur.noPayee') : r.label}</span>
                <span className="h-3 rounded-r max-md:order-4 max-md:col-start-2" style={{ width: `${Math.max(1, (r.amount / max) * 100)}%`, backgroundColor: SERIES_COLORS[1] }} aria-hidden="true" />
                <span className="text-right tabular-nums max-md:order-3">{fmt(r.amount)}</span>
                <span className="text-right text-xs text-slate-500 tabular-nums max-md:order-5 md:text-left">
                  {formatPercent(pct(r.amount))} · {r.count}×
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">
            {t('analytics.spentTotal', { amount: fmt(data.total) })}{data.others > 0 ? t('analytics.morePayees', { count: data.others }) : ''}
          </p>
        </>
      )}
    </article>
  );
}
