import type { ClearedStatus } from '../../engine/types.ts';

const LABELS: Record<ClearedStatus, string> = {
  uncleared: 'Not cleared: click when it shows up at your bank',
  cleared: 'Cleared: click to mark as not cleared',
  reconciled: 'Reconciled: locked by a finished reconciliation',
};

const STYLES: Record<ClearedStatus, string> = {
  uncleared: 'border border-slate-300 text-transparent hover:border-emerald-500 hover:text-emerald-500',
  cleared: 'bg-emerald-600 text-white',
  reconciled: 'bg-slate-500 text-white',
};

/** The small circle in each row: empty, ticked (cleared) or locked (reconciled). */
/** `large` gives a bigger touch target, for phones. */
export function ClearedToggle({ status, onToggle, large = false }: { status: ClearedStatus; onToggle: () => void; large?: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={LABELS[status]}
      aria-label={LABELS[status]}
      aria-pressed={status !== 'uncleared'}
      className={`flex shrink-0 items-center justify-center rounded-full text-[11px] leading-none ${large ? 'h-7 w-7' : 'h-5 w-5'} ${STYLES[status]}`}
    >
      {status === 'reconciled' ? (
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
          <rect x="2.5" y="5.5" width="7" height="5" rx="1" fill="currentColor" />
          <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      ) : (
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
          <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
