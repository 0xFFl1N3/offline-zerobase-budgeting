import { useState } from 'react';
import { useT } from '../../i18n/i18n.ts';
import { useNavigation } from '../../store/navigation.ts';

/** The last step after setup: starting mid-month gets three short points before the budget opens. */
export function MidMonth() {
  const t = useT();
  const setStart = useNavigation((s) => s.setStart);
  const [tips, setTips] = useState(false);
  const done = () => setStart(null);
  const button = 'rounded px-4 py-2 text-sm font-medium';
  return (
    <main className="mx-auto mt-24 max-w-md rounded-xl bg-white p-8 shadow">
      <h1 className="text-2xl font-semibold">{t('mid.title')}</h1>
      {!tips ? (
        <>
          <p className="mt-2 text-sm text-slate-600">{t('mid.intro')}</p>
          <div className="mt-6 flex gap-3">
            <button type="button" autoFocus onClick={() => setTips(true)} className={`${button} bg-sky-600 text-white hover:bg-sky-700`}>{t('mid.yes')}</button>
            <button type="button" onClick={done} className={`${button} border border-slate-300 text-slate-700 hover:bg-slate-50`}>{t('mid.no')}</button>
          </div>
        </>
      ) : (
        <>
          <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-slate-700">
            <li>{t('mid.tip1')}</li>
            <li>{t('mid.tip2')}</li>
            <li>{t('mid.tip3')}</li>
          </ol>
          <button type="button" autoFocus onClick={done} className={`${button} mt-6 bg-sky-600 text-white hover:bg-sky-700`}>{t('mid.toBudget')}</button>
        </>
      )}
    </main>
  );
}
