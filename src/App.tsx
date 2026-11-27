import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AnalyticsView } from './features/analytics/AnalyticsView.tsx';
import { AccountsSidebar } from './features/accounts/AccountsSidebar.tsx';
import { BudgetView } from './features/budget/BudgetView.tsx';
import { SettingsView } from './features/settings/SettingsView.tsx';
import { Setup } from './features/setup/Setup.tsx';
import { DemoBar } from './features/demo/DemoBar.tsx';
import { TransactionsView } from './features/transactions/TransactionsView.tsx';
import { AnalyticsIcon, BudgetIcon, CloseIcon, MenuIcon, SettingsIcon, TransactionsIcon } from './components/icons.tsx';
import { accountBalance } from './engine/budget.ts';
import { formatMoney } from './engine/money.ts';
import { dueItems } from './engine/recurring.ts';
import { toISODate } from './engine/months.ts';
import { useBudgetStore } from './store/budgetStore.ts';
import { useLanguage, useT, type MessageKey } from './i18n/i18n.ts';
import { requestPersistence } from './persistence.ts';
import { useNavigation, type Tab } from './store/navigation.ts';
import { UndoBar } from './features/undo/UndoBar.tsx';
import { VersionButton } from './features/changelog/Changelog.tsx';
import { ErrorBar, LoadFailed } from './features/errors/ErrorBar.tsx';
import { DebtDialog } from './features/debts/DebtDialog.tsx';
import { useAutoBackup } from './features/backup/AutoBackupCard.tsx';


const TABS: { id: Tab; label: MessageKey; icon: () => ReactNode }[] = [
  { id: 'budget', label: 'nav.budget', icon: BudgetIcon },
  { id: 'transactions', label: 'nav.transactions', icon: TransactionsIcon },
  { id: 'analytics', label: 'nav.analytics', icon: AnalyticsIcon },
  { id: 'settings', label: 'nav.settings', icon: SettingsIcon },
];

export default function App() {
  const ready = useBudgetStore((s) => s.ready);
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const dueCount = useBudgetStore((s) => dueItems(s.state.recurring, toISODate()).length);
  const load = useBudgetStore((s) => s.load);
  const problem = useBudgetStore((s) => s.problem);
  const demo = useBudgetStore((s) => s.demo);
  const t = useT();
  // Changing the language redraws everything below, so amounts and dates pick up the new format too.
  const language = useLanguage();
  const active = useNavigation((s) => s.tab);
  const setActive = useNavigation((s) => s.setTab);
  const debtDialog = useNavigation((s) => s.debtDialog);
  const openDebt = useNavigation((s) => s.openDebt);
  const closeDebt = useCallback(() => openDebt(null), [openDebt]);
  /** The accounts drawer on phones. */
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  // Once there is a budget, ask the browser to keep it (no-op when already granted or not supported).
  const hasBudget = ready && state.accounts.length > 0;
  useEffect(() => {
    if (hasBudget) void requestPersistence();
  }, [hasBudget]);
  // No automatic backups of sample data: they would only fill the folder with made-up budgets.
  useAutoBackup(hasBudget && !demo);

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
    <div className="fixed bottom-2 left-3 hidden md:block">
      <VersionButton />
    </div>
  );

  if (!ready) return problem ? <LoadFailed problem={problem} /> : <main className="p-8 text-slate-500">{t('app.loading')}</main>;
  if (state.accounts.length === 0) {
    return (
      <div key={language} className="min-h-screen bg-slate-50 text-slate-900">
        <Setup />
        <ErrorBar />
        <p className="pb-4 text-center md:hidden">
          <VersionButton />
        </p>
        {version}
      </div>
    );
  }

  const badge = dueCount > 0 && (
    <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-xs font-semibold leading-none text-white" title={t('nav.due', { count: dueCount })}>
      {dueCount}
    </span>
  );
  // Money in budget accounts; debts are listed separately in the accounts drawer.
  const total = state.accounts.filter((a) => !a.closed && a.type !== 'debt').reduce((sum, a) => sum + accountBalance(state, a.id), 0);
  const current = TABS.find((tab) => tab.id === active)!;

  return (
    <div key={language} className="flex min-h-screen bg-slate-50 text-slate-900">
      <div className="hidden md:flex">
        <AccountsSidebar />
      </div>

      <div className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
        <DemoBar />
        {/* Desktop: tabs along the top. */}
        <nav className="hidden gap-2 border-b border-slate-200 bg-white px-4 md:flex">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActive(tab.id)}
              aria-current={active === tab.id ? 'page' : undefined}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${tab.id === 'settings' ? 'ml-auto' : ''} ${active === tab.id ? 'border-sky-600 text-sky-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
            >
              {t(tab.label)}
              {tab.id === 'transactions' && badge}
            </button>
          ))}
        </nav>

        {/* Phone: a top bar with the accounts button and the current tab's name. */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-3 md:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label={t('nav.accounts')}
            aria-expanded={drawer}
            className="flex items-center gap-2 rounded px-1.5 py-1 text-slate-700 hover:bg-slate-100"
          >
            <MenuIcon />
          </button>
          <h1 className="text-base font-semibold">{t(current.label)}</h1>
          <button type="button" onClick={() => setDrawer(true)} className="ml-auto text-right text-xs text-slate-500">
            {t('nav.accounts')}
            <span className="block text-sm font-medium tabular-nums text-slate-900">{formatMoney(total, currency)}</span>
          </button>
        </header>

        <div className="mx-auto max-w-6xl">
          {active === 'budget' ? <BudgetView /> : active === 'transactions' ? <TransactionsView /> : active === 'analytics' ? <AnalyticsView /> : <SettingsView />}
        </div>
      </div>

      <UndoBar />
      <ErrorBar />
      {debtDialog && <DebtDialog debtId={debtDialog} onClose={closeDebt} />}

      {/* Phone: tabs along the bottom, within thumb reach. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            aria-current={active === tab.id ? 'page' : undefined}
            className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active === tab.id ? 'text-sky-700' : 'text-slate-500'}`}
          >
            <tab.icon />
            {t(tab.label)}
            {tab.id === 'transactions' && dueCount > 0 && <span className="absolute top-1.5 left-1/2 ml-2">{badge}</span>}
          </button>
        ))}
      </nav>

      {/* Phone: the accounts sidebar slides in from the left. */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label={t('nav.accounts')}>
          <button type="button" aria-label={t('nav.closeAccounts')} onClick={() => setDrawer(false)} className="absolute inset-0 h-full w-full bg-black/40" />
          <div className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col overflow-y-auto bg-white shadow-xl">
            <div className="flex justify-end px-2 pt-2">
              <button type="button" onClick={() => setDrawer(false)} aria-label={t('nav.closeAccounts')} className="rounded p-1.5 text-slate-600 hover:bg-slate-100">
                <CloseIcon />
              </button>
            </div>
            <AccountsSidebar className="w-full" />
            <p className="mt-auto px-4 pb-4">
              <VersionButton />
            </p>
          </div>
        </div>
      )}
      {version}
    </div>
  );
}
