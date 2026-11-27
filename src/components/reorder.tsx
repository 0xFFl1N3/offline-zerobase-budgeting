import { useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { t } from '../i18n/i18n.ts';

export type Place = 'before' | 'after';

/**
 * Drag-and-drop reordering for one list of siblings, using the browser's native drag events.
 * The `scope` passed to `rowProps` and `handle` keeps lists apart: an item can only be dropped among its own
 * siblings (e.g. the categories of one group). Each row gets `rowProps(id, scope)` and a `handle(id, label, scope)`. With the handle focused, the arrow keys move the item one step.
 */
export function useReorder(
  onMove: (id: string, targetId: string, place: Place) => void,
  onStep: (id: string, delta: -1 | 1) => void,
) {
  const mime = (scope: string) => `application/x-budget-${scope}`;
  const [over, setOver] = useState<{ id: string; place: Place } | null>(null);

  const placeFor = (e: DragEvent<HTMLElement>): Place => {
    const box = e.currentTarget.getBoundingClientRect();
    return e.clientY < box.top + box.height / 2 ? 'before' : 'after';
  };

  /**
   * `between`: the rows are separate cards with a gap between them, so the drop line is drawn in the gap
   * (outside the card) rather than along the row's own edge, where it would look like a drop into the card.
   */
  const rowProps = (id: string, scope: string, between = false) => ({
    'data-reorder-row': true,
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!e.dataTransfer.types.includes(mime(scope))) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const place = placeFor(e);
      if (over?.id !== id || over.place !== place) setOver({ id, place });
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      const dragged = e.dataTransfer.getData(mime(scope));
      if (!dragged) return;
      e.preventDefault();
      setOver(null);
      if (dragged !== id) onMove(dragged, id, placeFor(e));
    },
    style:
      over?.id === id
        ? between
          ? // Keep the card's own ring and shadow (Tailwind's variables) next to the line.
            { boxShadow: `${over.place === 'before' ? '0 -9px 0 -7px #0ea5e9' : '0 9px 0 -7px #0ea5e9'}, var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow, 0 0 #0000)` }
          : { boxShadow: over.place === 'before' ? 'inset 0 2px 0 0 #0ea5e9' : 'inset 0 -2px 0 0 #0ea5e9' }
        : undefined,
  });

  const handle = (id: string, label: string, scope: string): ReactNode => (
    <button
      type="button"
      draggable
      aria-label={t('reorder.handle', { name: label })}
      title={t('reorder.handleTitle')}
      onDragStart={(e) => {
        e.dataTransfer.setData(mime(scope), id);
        e.dataTransfer.effectAllowed = 'move';
        const row = e.currentTarget.closest('[data-reorder-row]');
        if (row) e.dataTransfer.setDragImage(row, 16, 8);
      }}
      onDragEnd={() => setOver(null)}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          onStep(id, e.key === 'ArrowUp' ? -1 : 1);
        }
      }}
      className="invisible cursor-grab rounded px-1 text-xs leading-none text-slate-400 hover:bg-slate-200 active:cursor-grabbing group-hover:visible group-focus-within:visible"
    >
      ⠿
    </button>
  );

  return { rowProps, handle };
}

/**
 * Up and down buttons for touch screens, where dragging is not available. Shown in place of the
 * amounts while a list is in "Reorder" mode.
 */
export function MoveButtons({ label, first, last, onStep }: { label: string; first: boolean; last: boolean; onStep: (delta: -1 | 1) => void }) {
  const button = 'flex h-9 w-9 items-center justify-center rounded border border-slate-300 bg-white text-slate-700 disabled:opacity-30';
  return (
    <span className="flex shrink-0 gap-1">
      <button type="button" aria-label={t('reorder.up', { name: label })} disabled={first} onClick={() => onStep(-1)} className={button}>
        ↑
      </button>
      <button type="button" aria-label={t('reorder.down', { name: label })} disabled={last} onClick={() => onStep(1)} className={button}>
        ↓
      </button>
    </span>
  );
}
