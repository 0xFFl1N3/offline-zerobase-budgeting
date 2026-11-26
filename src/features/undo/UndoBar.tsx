import { useEffect, useState } from 'react';
import { t } from '../../i18n/i18n.ts';
import type { MessageKey } from '../../i18n/i18n.ts';
import { useBudgetStore, type UndoKind } from '../../store/budgetStore.ts';

/** How long the bar stays after a delete. */
export const UNDO_SECONDS = 10;

const TEXT: Record<UndoKind, MessageKey> = {
  transaction: 'undo.transaction',
  account: 'undo.account',
  category: 'undo.category',
  group: 'undo.group',
  recurring: 'undo.recurring',
  goal: 'undo.goal',
};

/** Shown for a few seconds after a delete, with a button that brings the deleted data back. */
export function UndoBar() {
  const undo = useBudgetStore((s) => s.undo);
  const undoDelete = useBudgetStore((s) => s.undoDelete);
  const dismiss = useBudgetStore((s) => s.dismissUndo);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(dismiss, UNDO_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [undo, dismiss]);

  if (!undo) return null;
  // Phones: left-aligned, so it sits beside the add button instead of over it.
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 flex justify-start pr-24 pl-4 md:bottom-6 md:justify-center md:px-4" role="status" aria-live="polite">
      {/* Fixed colours: the theme mirrors Tailwind's greys in dark mode, which would turn this bar light. */}
      <div
        className="pointer-events-auto flex items-center gap-4 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 ring-white/15"
        style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
      >
        <span>{t(TEXT[undo.kind])}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void undoDelete().finally(() => setBusy(false));
          }}
          className="font-semibold text-sky-300 hover:text-sky-200 hover:underline"
        >
          {t('undo.button')}
        </button>
        <button type="button" onClick={dismiss} aria-label={t('undo.dismiss')} className="opacity-70 hover:opacity-100">
          ✕
        </button>
      </div>
    </div>
  );
}
