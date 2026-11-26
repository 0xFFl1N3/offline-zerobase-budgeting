import { useState } from 'react';
import type { Currency } from '../../engine/money.ts';
import { BackupPanel } from '../backup/BackupPanel.tsx';
import { loadPreference, savePreference, applyTheme, type ThemePreference } from '../../theme.ts';
import { useT } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { LanguageSelect } from './LanguageSelect.tsx';
import { StorageCard } from './StorageCard.tsx';

export function SettingsView() {
  const currency = useBudgetStore((s) => s.currency);
  const setCurrency = useBudgetStore((s) => s.setCurrency);
  const clearAllData = useBudgetStore((s) => s.clearAllData);
  const [theme, setTheme] = useState<ThemePreference>(loadPreference);
  const [clearing, setClearing] = useState(false);
  const [typed, setTyped] = useState('');
  const t = useT();
  const CONFIRM_WORD = t('settings.confirmWord');

  return (
    <section className="max-w-xl space-y-6 p-3 md:p-6">
      <div className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">{t('settings.language')}</h2>
        <LanguageSelect className="mt-3 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm" />
        <p className="mt-2 text-xs text-slate-500">{t('settings.deviceOnly')}</p>
      </div>

      <div className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">{t('settings.appearance')}</h2>
        <select
          aria-label={t('settings.theme')}
          value={theme}
          onChange={(e) => {
            const choice = e.target.value as ThemePreference;
            setTheme(choice);
            savePreference(choice);
            applyTheme(choice);
          }}
          className="mt-3 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="system">{t('settings.themeSystem')}</option>
          <option value="light">{t('settings.themeLight')}</option>
          <option value="dark">{t('settings.themeDark')}</option>
        </select>
        <p className="mt-2 text-xs text-slate-500">{t('settings.deviceOnly')}</p>
      </div>

      <div className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">{t('settings.currency')}</h2>
        <select
          aria-label={t('settings.currency')}
          value={currency}
          onChange={(e) => void setCurrency(e.target.value as Currency)}
          className="mt-3 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="EUR">{t('currency.EUR')}</option>
          <option value="USD">{t('currency.USD')}</option>
        </select>
        <p className="mt-2 text-xs text-slate-500">{t('settings.currencyHint')}</p>
      </div>

      <BackupPanel variant="card" />

      <StorageCard />

      <div className="rounded-lg border border-red-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-red-700">{t('settings.clearTitle')}</h2>
        <p className="mt-2 text-sm text-slate-600">{t('settings.clearText')}</p>
        {clearing ? (
          <form
            className="mt-3 flex flex-wrap items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed === CONFIRM_WORD) void clearAllData();
            }}
          >
            <label className="text-sm">
              {t('settings.typeBefore')} <strong>{CONFIRM_WORD}</strong> {t('settings.typeAfter')}
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className="ml-2 w-28 rounded border border-slate-300 px-2 py-1 text-sm"
              />
            </label>
            <button
              type="submit"
              disabled={typed !== CONFIRM_WORD}
              className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 disabled:hover:bg-red-600"
            >
              {t('settings.deleteEverything')}
            </button>
            <button
              type="button"
              onClick={() => {
                setClearing(false);
                setTyped('');
              }}
              className="text-sm text-slate-600 hover:underline"
            >
              {t('common.cancel')}
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setClearing(true)} className="mt-3 rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
            {t('settings.clearButton')}
          </button>
        )}
      </div>
    </section>
  );
}
