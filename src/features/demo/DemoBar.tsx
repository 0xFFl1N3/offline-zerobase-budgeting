import { useT } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';

/** While the app holds the sample data: says so, and offers to start over with an own budget. */
export function DemoBar() {
  const t = useT();
  const demo = useBudgetStore((s) => s.demo);
  const clearAllData = useBudgetStore((s) => s.clearAllData);
  if (!demo) return null;
  const leave = () => {
    if (window.confirm(t('demo.leaveConfirm'))) void clearAllData();
  };
  return (
    <div role="status" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span>{t('demo.notice')}</span>
      <button type="button" onClick={leave} className="rounded border border-amber-300 px-2.5 py-1 font-medium hover:bg-amber-100">
        {t('demo.leave')}
      </button>
    </div>
  );
}
