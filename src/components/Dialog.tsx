import { useEffect, useId, useRef, type ReactNode } from 'react';
import { t } from '../i18n/i18n.ts';

/**
 * A panel over a blurred page. Closes with ✕, Esc or a click outside; focus moves into it and back afterwards.
 * Esc is caught first, so it closes only this and not, for example, the accounts drawer behind it.
 */
export function Dialog({ title, onClose, children, wide = false }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" aria-label={t('common.close')} onClick={onClose} className="absolute inset-0 h-full w-full cursor-default bg-black/30 backdrop-blur-sm" />
      <div className={`relative flex max-h-[85vh] w-full flex-col rounded-lg bg-white shadow-xl ${wide ? 'max-w-2xl' : 'max-w-lg'}`}>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h2 id={titleId} className="text-base font-semibold">{title}</h2>
          <button ref={closeButton} type="button" onClick={onClose} aria-label={t('common.close')} className="rounded p-1.5 text-slate-600 hover:bg-slate-100">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 text-sm">{children}</div>
      </div>
    </div>
  );
}
