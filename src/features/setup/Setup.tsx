import { useState } from 'react';
import { type Currency } from '../../engine/money.ts';
import { parseAmountInput } from '../../engine/amountInput.ts';
import { useLanguage, useT } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { LanguageSelect } from '../settings/LanguageSelect.tsx';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';
import { Form } from '../../components/Form.tsx';

const field = 'mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2';

export function Setup() {
  const t = useT();
  const completeSetup = useBudgetStore((s) => s.completeSetup);
  const startDemo = useBudgetStore((s) => s.startDemo);
  const language = useLanguage();
  const [accountName, setAccountName] = useState(() => t('setup.defaultAccountName'));
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState<Currency>('EUR');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const initialBalance = parseAmountInput(balance);
    if (!accountName.trim()) return setError(t('setup.errorName'));
    if (initialBalance === null) return setError(t('setup.errorBalance'));
    setError(null);
    void completeSetup({ accountName, initialBalance, currency });
  };

  return (
    <main className="mx-auto mt-24 max-w-md rounded-xl bg-white p-8 shadow">
      <h1 className="text-2xl font-semibold">{t('setup.title')}</h1>
      <p className="mt-2 text-sm text-slate-600">{t('setup.intro')}</p>
      <Form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium">
          {t('setup.language')}
          <LanguageSelect className={field} />
        </label>
        <label className="block text-sm font-medium">
          {t('setup.accountName')}
          <input {...NO_AUTOFILL} value={accountName} onChange={(e) => setAccountName(e.target.value)} className={field} />
        </label>
        <label className="block text-sm font-medium">
          {t('setup.balance')}
          <input {...NO_AUTOFILL}
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            inputMode="decimal"
            placeholder={t('common.amountPlaceholder')}
            autoFocus
            className={field}
          />
        </label>
        <label className="block text-sm font-medium">
          {t('setup.currency')}
          <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={field}>
            <option value="EUR">{t('currency.EUR')}</option>
            <option value="USD">{t('currency.USD')}</option>
          </select>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="w-full rounded bg-sky-600 py-2 font-medium text-white hover:bg-sky-700">
          {t('setup.start')}
        </button>
      </Form>
      <div className="mt-6 border-t border-slate-200 pt-5 text-center">
        <button
          type="button"
          onClick={() => void startDemo(language)}
          className="w-full rounded border border-slate-300 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t('setup.demo')}
        </button>
        <p className="mt-2 text-xs text-slate-500">{t('setup.demoHint')}</p>
      </div>
    </main>
  );
}
