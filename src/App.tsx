import { useEffect, useState } from 'react';
import { AnalyticsView } from './features/analytics/AnalyticsView.tsx';
import { AccountsSidebar } from './features/accounts/AccountsSidebar.tsx';
import { BudgetView } from './features/budget/BudgetView.tsx';
import { SettingsView } from './features/settings/SettingsView.tsx';
import { Setup } from './features/setup/Setup.tsx';
import { TransactionsView } from './features/transactions/TransactionsView.tsx';
import { useBudgetStore } from './store/budgetStore.ts';

type Tab = 'budget' | 'transactions' | 'analytics' | 'settings';

export default function App() {
  const ready = useBudgetStore((s) => s.ready);
  const hasAccounts = useBudgetStore((s) => s.state.accounts.length > 0);
  const load = useBudgetStore((s) => s.load);
  const [tab, setTab] = useState<Tab>('budget');

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) return <main className="p-8 text-slate-500">Loading…</main>;
  if (!hasAccounts) return <div className="min-h-screen bg-slate-50 text-slate-900"><Setup /></div>;

  const tabClass = (t: Tab) =>
    `px-4 py-3 text-sm font-medium border-b-2 ${tab === t ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <AccountsSidebar />
      <div className="min-w-0 flex-1">
        <nav className="flex gap-2 border-b border-slate-200 bg-white px-4">
          <button type="button" className={tabClass('budget')} onClick={() => setTab('budget')}>Budget</button>
          <button type="button" className={tabClass('transactions')} onClick={() => setTab('transactions')}>Transactions</button>
          <button type="button" className={tabClass('analytics')} onClick={() => setTab('analytics')}>Analytics</button>
          <button type="button" className={`${tabClass('settings')} ml-auto`} onClick={() => setTab('settings')}>Settings</button>
        </nav>
        <div className="mx-auto max-w-6xl">{tab === 'budget' ? <BudgetView /> : tab === 'transactions' ? <TransactionsView /> : tab === 'analytics' ? <AnalyticsView /> : <SettingsView />}</div>
      </div>
    </div>
  );
}
