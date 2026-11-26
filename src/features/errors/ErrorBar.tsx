import { t } from '../../i18n/i18n.ts';
import type { Problem } from '../../i18n/errors.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';

/** The text for a problem, in the current language. */
export const problemText = (problem: Problem) => t(problem.message, { detail: problem.detail });

/** Shows a failed save (or any other unexpected error) at the top of the screen until closed. */
export function ErrorBar() {
  const problem = useBudgetStore((s) => s.problem);
  const dismiss = useBudgetStore((s) => s.dismissProblem);
  if (!problem) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex justify-center px-4" role="alert">
      {/* Fixed colours: the theme mirrors Tailwind's greys in dark mode. */}
      <div
        className="pointer-events-auto flex max-w-xl items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ring-white/15"
        style={{ backgroundColor: '#991b1b', color: '#ffffff' }}
      >
        <span className="flex-1">{problemText(problem)}</span>
        {problem.reload && (
          <button type="button" onClick={() => location.reload()} className="font-semibold underline-offset-2 hover:underline">
            {t('error.reload')}
          </button>
        )}
        <button type="button" onClick={dismiss} aria-label={t('error.close')} className="opacity-80 hover:opacity-100">
          ✕
        </button>
      </div>
    </div>
  );
}

/** Instead of "Loading…" forever when the budget cannot be opened. */
export function LoadFailed({ problem }: { problem: Problem }) {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-lg font-semibold">{t('error.loadFailed')}</h1>
      <p className="mt-3 text-sm text-slate-700">{problemText(problem)}</p>
      {problem.detail && <p className="mt-3 text-xs text-slate-500">{t('error.details', { detail: problem.detail })}</p>}
      <button type="button" onClick={() => location.reload()} className="mt-5 rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700">
        {t('error.reload')}
      </button>
    </main>
  );
}

/**
 * Last safety net: an error nobody handled (a rule error from a button without its own message, or a bug)
 * still gets shown. Errors the store already showed are skipped.
 */
export function installErrorSafetyNet(report: (error: unknown) => void) {
  window.addEventListener('unhandledrejection', (event) => {
    event.preventDefault();
    report(event.reason);
  });
  window.addEventListener('error', (event) => {
    if (event.error instanceof Error) report(event.error);
  });
}
