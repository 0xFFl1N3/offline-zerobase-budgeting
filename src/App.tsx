import { useEffect, useState, type ReactNode } from 'react';
import { AnalyticsView } from './features/analytics/AnalyticsView.tsx';
import { AccountsSidebar } from './features/accounts/AccountsSidebar.tsx';
import { BudgetView } from './features/budget/BudgetView.tsx';
import { SettingsView } from './features/settings/SettingsView.tsx';
import { Setup } from './features/setup/Setup.tsx';
import { TransactionsView } from './features/transactions/TransactionsView.tsx';
import { AnalyticsIcon, BudgetIcon, CloseIcon, MenuIcon, SettingsIcon, TransactionsIcon } from './components/icons.tsx';
import { accountBalance } from './engine/budget.ts';
import { formatMoney } from './engine/money.ts';
import { dueItems } from './engine/recurring.ts';
import { toISODate } from './engine/months.ts';
import { useBudgetStore } from './store/budgetStore.ts';
import { APP_VERSION } from './version.ts';

type Tab = 'budget' | 'transactions' | 'analytics' | 'settings';

const TABS: { id: Tab; label: string; icon: () => ReactNode }[] = [
  { id: 'budget', label: 'Budget', icon: BudgetIcon },
  { id: 'transactions', label: 'Transactions', icon: TransactionsIcon },
  { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function App() {
  const ready = useBudgetStore((s) => s.ready);
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const dueCount = useBudgetStore((s) => dueItems(s.state.recurring, toISODate()).length);
  const load = useBudgetStore((s) => s.load);
  const [tab, setTab] = useState<Tab>('budget');
  /** The accounts drawer on phones. */
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  // While the drawer is open: Escape closes it and the page behind it does not scroll.
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [drawer]);

  const version = (
    <div className="pointer-events-none fixed bottom-2 left-3 hidden select-none text-xs text-slate-600 md:block" aria-label={`Version ${APP_VERSION}`}>
      v{APP_VERSION}
    </div>
  );

  if (!ready) return <main className="p-8 text-slate-500">Loading…</main>;
  if (state.accounts.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Setup />
        <p className="pb-4 text-center text-xs text-slate-600 md:hidden">v{APP_VERSION}</p>
        {version}
      </div>
    );
  }

  const badge = dueCount > 0 && (
    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white" title={`${dueCount} recurring transaction${dueCount === 1 ? '' : 's'} due`}>
      {dueCount}
    </span>
  );
  const total = state.accounts.filter((a) => !a.closed).reduce((sum, a) => sum + accountBalance(state, a.id), 0);
  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <div className="hidden md:flex">
        <AccountsSidebar />
      </div>

      <div className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        {/* Desktop: tabs along the top. */}
        <nav className="hidden gap-2 border-b border-slate-200 bg-white px-4 md:flex">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${t.id === 'settings' ? 'ml-auto' : ''} ${tab === t.id ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              {t.label}
              {t.id === 'transactions' && badge}
            </button>
          ))}
        </nav>

        {/* Phone: a top bar with the accounts button and the current tab's name. */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Accounts"
            aria-expanded={drawer}
            className="flex items-center gap-2 rounded px-1.5 py-1 text-slate-700 hover:bg-slate-100"
          >
            <MenuIcon />
          </button>
          <h1 className="text-base font-semibold">{current.label}</h1>
          <button type="button" onClick={() => setDrawer(true)} className="ml-auto text-right text-xs text-slate-500">
            Accounts
            <span className="block text-sm font-medium tabular-nums text-slate-900">{formatMoney(total, currency)}</span>
          </button>
        </header>

        <div className="mx-auto max-w-6xl">
          {tab === 'budget' ? <BudgetView /> : tab === 'transactions' ? <TransactionsView /> : tab === 'analytics' ? <AnalyticsView /> : <SettingsView />}
        </div>
      </div>

      {/* Phone: tabs along the bottom, within thumb reach. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${tab === t.id ? 'text-sky-700' : 'text-slate-500'}`}
          >
            <t.icon />
            {t.label}
            {t.id === 'transactions' && dueCount > 0 && <span className="absolute top-1.5 left-1/2 ml-2">{badge}</span>}
          </button>
        ))}
      </nav>

      {/* Phone: the accounts sidebar slides in from the left. */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Accounts">
          <button type="button" aria-label="Close accounts" onClick={() => setDrawer(false)} className="absolute inset-0 h-full w-full bg-black/40" />
          <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-xl">
            <div className="flex justify-end px-2 pt-2">
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close accounts" className="rounded p-1.5 text-slate-600 hover:bg-slate-100">
                <CloseIcon />
              </button>
            </div>
            <AccountsSidebar className="w-full" />
            <p className="mt-auto px-4 pb-4 text-xs text-slate-600">v{APP_VERSION}</p>
          </div>
        </div>
      )}
      {version}
    </div>
  );
}
