import { categoryActivity, categoryAssigned, categoryAvailable, readyToAssign } from '../../engine/budget.ts';
import { formatMoney } from '../../engine/money.ts';
import type { Cents } from '../../engine/types.ts';
import { InlineAdd } from '../../components/InlineAdd.tsx';
import { MoneyField } from '../../components/MoneyField.tsx';
import { useBudgetStore } from '../../store/budgetStore.ts';

const COLUMNS = 'grid grid-cols-[1fr_8rem_8rem_8rem] items-center gap-2';

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function ReadyToAssignPill({ amount, currency }: { amount: Cents; currency: 'EUR' | 'USD' }) {
  const tone =
    amount === 0
      ? 'bg-emerald-100 text-emerald-800'
      : amount > 0
        ? 'bg-amber-100 text-amber-800'
        : 'bg-red-100 text-red-800';
  const hint = amount === 0 ? 'Every euro has a job' : amount > 0 ? 'left to assign' : 'over-assigned';
  return (
    <div className={`rounded-full px-4 py-2 text-sm font-medium ${tone}`}>
      Ready to Assign: <span className="tabular-nums">{formatMoney(amount, currency)}</span>
      <span className="ml-2 font-normal">{hint}</span>
    </div>
  );
}

const availableTone = (cents: Cents) =>
  cents < 0 ? 'text-red-600 font-medium' : cents === 0 ? 'text-slate-400' : 'text-emerald-700';

export function BudgetView() {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const month = useBudgetStore((s) => s.month);
  const shiftMonth = useBudgetStore((s) => s.shiftMonth);
  const assign = useBudgetStore((s) => s.assign);
  const addGroup = useBudgetStore((s) => s.addGroup);
  const addCategory = useBudgetStore((s) => s.addCategory);

  const rta = readyToAssign(state, month);
  const groups = state.groups.filter((g) => !g.archived);

  return (
    <section className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)} className="rounded px-2 py-1 hover:bg-slate-200">
            ‹
          </button>
          <h2 className="min-w-44 text-center text-lg font-semibold">{monthLabel(month)}</h2>
          <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)} className="rounded px-2 py-1 hover:bg-slate-200">
            ›
          </button>
        </div>
        <ReadyToAssignPill amount={rta} currency={currency} />
      </div>

      <div className="mt-6 rounded-lg bg-white shadow-sm">
        <div className={`${COLUMNS} border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500`}>
          <span>Category</span>
          <span className="text-right">Assigned</span>
          <span className="text-right">Activity</span>
          <span className="text-right">Available</span>
        </div>

        {groups.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">
            No categories yet. Add a group such as "Living", then add categories like Rent or Electricity to it.
          </p>
        )}

        {groups.map((group) => {
          const cats = state.categories.filter((c) => c.groupId === group.id && !c.archived);
          const sum = (f: (id: string) => Cents) => cats.reduce((t, c) => t + f(c.id), 0);
          return (
            <div key={group.id} className="border-b border-slate-100 last:border-b-0">
              <div className={`${COLUMNS} bg-slate-50 px-4 py-2 text-sm font-semibold`}>
                <span>{group.name}</span>
                <span className="px-2 text-right tabular-nums">{formatMoney(sum((id) => categoryAssigned(state, id, month)), currency)}</span>
                <span className="px-2 text-right tabular-nums">{formatMoney(sum((id) => categoryActivity(state, id, month)), currency)}</span>
                <span className="px-2 text-right tabular-nums">{formatMoney(sum((id) => categoryAvailable(state, id, month)), currency)}</span>
              </div>
              {cats.map((cat) => {
                const available = categoryAvailable(state, cat.id, month);
                return (
                  <div key={cat.id} className={`${COLUMNS} px-4 py-1 text-sm`}>
                    <span className="pl-4">{cat.name}</span>
                    <MoneyField
                      ariaLabel={`Assigned to ${cat.name}`}
                      value={categoryAssigned(state, cat.id, month)}
                      onCommit={(cents) => void assign(cat.id, cents)}
                    />
                    <span className="px-2 text-right tabular-nums text-slate-600">
                      {formatMoney(categoryActivity(state, cat.id, month), currency)}
                    </span>
                    <span className={`px-2 text-right tabular-nums ${availableTone(available)}`}>
                      {formatMoney(available, currency)}
                    </span>
                  </div>
                );
              })}
              <div className="px-8 py-2">
                <InlineAdd label="Add category" placeholder="Category name" onAdd={(name) => void addCategory(group.id, name)} />
              </div>
            </div>
          );
        })}

        <div className="border-t border-slate-200 px-4 py-3">
          <InlineAdd label="Add group" placeholder="Group name" onAdd={(name) => void addGroup(name)} />
        </div>
      </div>
    </section>
  );
}
