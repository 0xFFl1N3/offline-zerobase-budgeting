import { useCallback, useState } from 'react';
import { classify, isReported, markReported } from '../../i18n/errors.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';

/**
 * For screens that need to know whether a change worked: `run(fn)` resolves to true or false.
 * A rule error (e.g. "an account with transactions cannot be deleted") is kept in `error` to show next to the
 * button; storage problems are already in the error bar (the store reports them), so they are not repeated here.
 * `setError` is for the screen's own checks before saving.
 */
export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async (fn: () => unknown): Promise<boolean> => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      const problem = classify(e);
      if (problem.kind === 'rule') setError(problem.detail);
      else if (!isReported(e)) useBudgetStore.getState().reportProblem(problem);
      markReported(e);
      return false;
    }
  }, []);
  return { run, error, setError };
}
