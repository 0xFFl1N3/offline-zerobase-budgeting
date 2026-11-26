interface Props {
  label: string;
  /** null = already at that end. */
  onUp: (() => void) | null;
  onDown: (() => void) | null;
}

/** Up/down arrows to reorder an item. Shown on hover or keyboard focus of the surrounding `group` element. */
export function MoveButtons({ label, onUp, onDown }: Props) {
  const base = 'rounded px-1 text-xs leading-none text-slate-500 hover:bg-slate-200 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <span className="invisible inline-flex group-hover:visible group-focus-within:visible">
      <button type="button" aria-label={`Move ${label} up`} disabled={!onUp} onClick={() => onUp?.()} className={base}>
        ▲
      </button>
      <button type="button" aria-label={`Move ${label} down`} disabled={!onDown} onClick={() => onDown?.()} className={base}>
        ▼
      </button>
    </span>
  );
}
