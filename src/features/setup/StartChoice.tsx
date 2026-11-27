import { useT } from '../../i18n/i18n.ts';
import { useNavigation } from '../../store/navigation.ts';

/** Right after setup: start from suggested categories, or with an empty budget. */
export function StartChoice() {
  const t = useT();
  const setStart = useNavigation((s) => s.setStart);
  const choice = 'block w-full rounded-lg border border-slate-200 bg-white px-5 py-4 text-left hover:border-sky-500 hover:bg-sky-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500';
  return (
    <main className="mx-auto mt-24 max-w-md rounded-xl bg-white p-8 shadow">
      <h1 className="text-2xl font-semibold">{t('start.title')}</h1>
      <p className="mt-2 text-sm text-slate-600">{t('start.intro')}</p>
      <div className="mt-6 space-y-3">
        <button type="button" autoFocus onClick={() => setStart({ step: 'suggestions', firstRun: true })} className={choice}>
          <span className="block font-medium text-slate-900">{t('start.suggested')}</span>
          <span className="mt-0.5 block text-sm text-slate-600">{t('start.suggestedHint')}</span>
        </button>
        <button type="button" onClick={() => setStart({ step: 'midMonth', firstRun: true })} className={choice}>
          <span className="block font-medium text-slate-900">{t('start.own')}</span>
          <span className="mt-0.5 block text-sm text-slate-600">{t('start.ownHint')}</span>
        </button>
      </div>
    </main>
  );
}
