import { formatMoney, type Currency } from '../../engine/money.ts';
import { formatMonth } from '../../engine/months.ts';
import type { MonthValue, TrendTarget } from '../../engine/reports.ts';
import type { BudgetState } from '../../engine/types.ts';
import { DataTable } from './ChartFrame.tsx';
import { SERIES_COLORS } from './colors.ts';
import { LineChart } from './LineChart.tsx';

interface Props {
  state: BudgetState;
  target: TrendTarget | null;
  onTarget: (target: TrendTarget) => void;
  rows: MonthValue[];
  currency: Currency;
}

const keyOf = (t: TrendTarget | null) => (t ? `${t.kind}:${t.id}` : '');

export function TrendChart({ state, target, onTarget, rows, currency }: Props) {
  const fmt = (c: number) => formatMoney(c, currency);
  const groups = [...state.groups].sort((a, b) => a.sortOrder - b.sortOrder);
  const nameOf = (t: TrendTarget) =>
    t.kind === 'group' ? `All of ${state.groups.find((g) => g.id === t.id)?.name ?? '?'}` : (state.categories.find((c) => c.id === t.id)?.name ?? '?');
  const total = rows.reduce((t, r) => t + r.value, 0);
  const average = rows.length > 0 ? Math.round(total / rows.length) : 0;

  return (
    <article className="rounded-lg bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Spending trend</h3>
          <p className="text-xs text-slate-500">Spending per month in one category or group</p>
        </div>
        <select
          aria-label="Category or group"
          value={keyOf(target)}
          onChange={(e) => {
            const [kind, id] = e.target.value.split(':') as [TrendTarget['kind'], string];
            onTarget({ kind, id });
          }}
          className="max-w-56 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
        >
          {target === null && <option value="">Choose…</option>}
          {groups.map((g) => {
            const categories = state.categories.filter((c) => c.groupId === g.id).sort((a, b) => a.sortOrder - b.sortOrder);
            if (categories.length === 0) return null;
            return (
              <optgroup key={g.id} label={g.name + (g.archived ? ' (archived)' : '')}>
                <option value={`group:${g.id}`}>All of {g.name}</option>
                {categories.map((c) => (
                  <option key={c.id} value={`category:${c.id}`}>
                    {c.name}{c.archived ? ' (archived)' : ''}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>
      {target === null ? (
        <p className="mt-6 text-sm text-slate-500">No spending in this period yet. Pick a category to see its months.</p>
      ) : (
        <>
          <p className="mt-3 text-lg font-semibold tabular-nums">
            {fmt(average)} <span className="text-sm font-normal text-slate-500">per month on average · {fmt(total)} in total</span>
          </p>
          <div className="mt-3">
            <LineChart
              rows={rows}
              currency={currency}
              color={SERIES_COLORS[1]}
              label={`Spending per month: ${nameOf(target)}`}
              describe={(r) => `${formatMonth(r.month)}: ${fmt(r.value)} spent on ${nameOf(target)}`}
            />
          </div>
          <DataTable head={['Month', 'Spent']} rows={rows.map((r) => [formatMonth(r.month), fmt(r.value)])} />
        </>
      )}
    </article>
  );
}
