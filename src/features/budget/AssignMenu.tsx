import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ASSIGN_KINDS, type AssignKind, type AutoAssignPlan } from '../../engine/autoassign.ts';
import { useT } from '../../i18n/i18n.ts';

interface Props {
  /** The plan for each way of assigning, for this month. */
  plans: Record<AssignKind, AutoAssignPlan>;
  format: (cents: number) => string;
  onPick: (kind: AssignKind) => void;
}

/**
 * The Auto-assign button and its menu. Each entry says up front how much it would assign; one with nothing to do
 * says why in plain text (never only in a tooltip, which phones do not show).
 */
export function AssignMenu({ plans, format, onPick }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const anything = ASSIGN_KINDS.some((k) => plans[k].steps.length > 0);

  // A click anywhere else closes the menu.
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);

  const items = (): HTMLButtonElement[] => Array.from(box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      button.current?.focus();
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const list = items();
      const at = list.indexOf(document.activeElement as HTMLButtonElement);
      list[(at + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus();
    }
  };

  return (
    <div ref={box} className="relative ml-auto" onKeyDown={onKey}>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          if (!open) requestAnimationFrame(() => items()[0]?.focus());
        }}
        className={`flex items-center gap-1.5 rounded border px-3 py-2 text-sm font-medium ${anything ? 'border-sky-600 text-sky-700 hover:bg-sky-50' : 'border-slate-300 text-slate-500 hover:bg-slate-50'}`}
      >
        {t('budget.autoAssign')}
        <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div role="menu" aria-label={t('budget.autoAssign')} className="absolute right-0 top-full z-30 mt-1 w-80 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
          {ASSIGN_KINDS.map((kind) => {
            const plan = plans[kind];
            const none = plan.steps.length === 0;
            return (
              <button
                key={kind}
                type="button"
                role="menuitem"
                disabled={none}
                onClick={() => {
                  setOpen(false);
                  onPick(kind);
                }}
                className={`block w-full border-b border-slate-100 px-4 py-2.5 text-left last:border-b-0 focus:bg-sky-50 focus:outline-none ${none ? 'cursor-default' : 'hover:bg-sky-50'}`}
              >
                <span className="flex items-baseline gap-3">
                  <span className={`flex-1 text-sm font-medium ${none ? 'text-slate-500' : 'text-slate-900'}`}>{t(`assign.${kind}`)}</span>
                  {!none && <span className="text-sm font-medium tabular-nums text-sky-700">{format(plan.total)}</span>}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{none ? t(`assign.${kind}None`) : t(`assign.${kind}Hint`)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
