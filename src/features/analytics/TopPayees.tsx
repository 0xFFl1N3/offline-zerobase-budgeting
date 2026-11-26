import { formatMoney, type Currency } from '../../engine/money.ts';
import type { TopPayees as TopPayeesData } from '../../engine/reports.ts';
import { SERIES_COLORS } from './colors.ts';

export function TopPayees({ data, currency }: { data: TopPayeesData; currency: Currency }) {
  const fmt = (c: number) => formatMoney(c, currency);
  const max = data.rows[0]?.amount ?? 0;
  const pct = (c: number) => (data.total > 0 ? Math.round((c / data.total) * 1000) / 10 : 0);
  return (
    <article className="rounded-lg bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold">Top payees</h3>
      <p className="text-xs text-slate-500">Where the most money went in this period</p>
      {data.rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">No spending in this period.</p>
      ) : (
        <>
          <ol className="mt-4 space-y-2 text-sm">
            {data.rows.map((r, i) => (
              <li key={r.label} className="grid grid-cols-[1.5rem_minmax(0,9rem)_1fr_auto] items-center gap-x-3">
                <span className="text-right text-xs text-slate-500 tabular-nums">{i + 1}</span>
                <span className="truncate" title={r.label}>{r.label}</span>
                <span className="h-3 rounded-r" style={{ width: `${Math.max(1, (r.amount / max) * 100)}%`, backgroundColor: SERIES_COLORS[1] }} aria-hidden="true" />
                <span className="text-right tabular-nums">
                  {fmt(r.amount)}{' '}
                  <span className="inline-block w-24 text-xs text-slate-500">
                    {pct(r.amount)}% · {r.count}×
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">
            {fmt(data.total)} spent in total{data.others > 0 ? ` · ${data.others} more payee${data.others === 1 ? '' : 's'} not listed` : ''}
          </p>
        </>
      )}
    </article>
  );
}
