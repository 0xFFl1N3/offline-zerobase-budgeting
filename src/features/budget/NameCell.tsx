import type { ReactNode } from 'react';

interface Props {
  name: string;
  renaming: boolean;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  /** Label of the action shown on hover: "Delete", or "Archive" when the item has history. */
  actionLabel: string;
  onAction: () => void;
  /** Drag handle for reordering (see useReorder). */
  handle: ReactNode;
}

/** A group or category name: click it to rename in place. An Archive or Delete action appears on hover or keyboard focus. */
export function NameCell({ name, renaming, onStartRename, onRename, onCancelRename, actionLabel, onAction, handle }: Props) {
  if (renaming) {
    return (
      <input
        autoFocus
        defaultValue={name}
        aria-label={`Rename ${name}`}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={onCancelRename}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value.trim()) onRename(e.currentTarget.value);
          if (e.key === 'Escape') onCancelRename();
        }}
        className="rounded border border-sky-500 px-2 py-0.5 text-sm font-normal focus:outline-none"
      />
    );
  }
  return (
    <span className="group inline-flex items-center gap-3">
      <button
        type="button"
        onClick={onStartRename}
        aria-label={`Rename ${name}`}
        title="Click to rename"
        className="cursor-text rounded text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        {name}
      </button>
      <button
        type="button"
        onClick={onAction}
        aria-label={`${actionLabel} ${name}`}
        className="invisible text-xs font-normal text-red-600 hover:underline group-hover:visible group-focus-within:visible"
      >
        {actionLabel}
      </button>
      {handle}
    </span>
  );
}
