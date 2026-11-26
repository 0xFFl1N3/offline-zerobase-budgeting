import { useState } from 'react';
import type { Currency } from '../../engine/money.ts';
import { BackupPanel } from '../backup/BackupPanel.tsx';
import { loadPreference, savePreference, applyTheme, type ThemePreference } from '../../theme.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';

const CONFIRM_WORD = 'DELETE';

export function SettingsView() {
  const currency = useBudgetStore((s) => s.currency);
  const setCurrency = useBudgetStore((s) => s.setCurrency);
  const clearAllData = useBudgetStore((s) => s.clearAllData);
  const [theme, setTheme] = useState<ThemePreference>(loadPreference);
  const [clearing, setClearing] = useState(false);
  const [typed, setTyped] = useState('');

  return (
    <section className="max-w-xl space-y-6 p-6">
      <div className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <select
          aria-label="Theme"
          value={theme}
          onChange={(e) => {
            const choice = e.target.value as ThemePreference;
            setTheme(choice);
            savePreference(choice);
            applyTheme(choice);
          }}
          className="mt-3 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="system">Same as my system</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
        <p className="mt-2 text-xs text-slate-500">Remembered on this device only; it is not part of a backup.</p>
      </div>

      <div className="rounded-lg bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Currency</h2>
        <select
          aria-label="Currency"
          value={currency}
          onChange={(e) => void setCurrency(e.target.value as Currency)}
          className="mt-3 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="EUR">Euro (EUR)</option>
          <option value="USD">US dollar (USD)</option>
        </select>
        <p className="mt-2 text-xs text-slate-500">
          Only changes how amounts are shown. Nothing is converted, so 100.00 stays 100.00.
        </p>
      </div>

      <BackupPanel variant="card" />

      <div className="rounded-lg border border-red-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-red-700">Clear all data</h2>
        <p className="mt-2 text-sm text-slate-600">
          Deletes every account, category, goal and transaction from this browser and returns to the setup screen.
          This cannot be undone, so export a backup first.
        </p>
        {clearing ? (
          <form
            className="mt-3 flex flex-wrap items-center gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed === CONFIRM_WORD) void clearAllData();
            }}
          >
            <label className="text-sm">
              Type <strong>{CONFIRM_WORD}</strong> to confirm
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
              Delete everything
            </button>
            <button
              type="button"
              onClick={() => {
                setClearing(false);
                setTyped('');
              }}
              className="text-sm text-slate-600 hover:underline"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button type="button" onClick={() => setClearing(true)} className="mt-3 rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
            Clear all data…
          </button>
        )}
      </div>
    </section>
  );
}
