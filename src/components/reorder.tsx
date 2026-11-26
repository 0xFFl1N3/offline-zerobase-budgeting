import { useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';

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

  const rowProps = (id: string, scope: string) => ({
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
    style: over?.id === id ? { boxShadow: over.place === 'before' ? 'inset 0 2px 0 0 #0ea5e9' : 'inset 0 -2px 0 0 #0ea5e9' } : undefined,
  });

  const handle = (id: string, label: string, scope: string): ReactNode => (
    <button
      type="button"
      draggable
      aria-label={`Reorder ${label}`}
      title="Drag to reorder (or use the arrow keys)"
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
