import type { ReactNode } from 'react';
import { t } from '../../i18n/i18n.ts';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';

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
  /** Optional extra action shown with the others on hover or keyboard focus, e.g. "Set goal". */
  extraAction?: { label: string; onClick: () => void };
}

/** A group or category name: click it to rename in place. An Archive or Delete action appears on hover or keyboard focus. */
export function NameCell({ name, renaming, onStartRename, onRename, onCancelRename, actionLabel, onAction, handle, extraAction }: Props) {
  if (renaming) {
    return (
      <input {...NO_AUTOFILL}
        autoFocus
        defaultValue={name}
        aria-label={t('budget.renameName', { name })}
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
        aria-label={t('budget.renameName', { name })}
        title={t('budget.clickToRename')}
        className="cursor-text rounded text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
      >
        {name}
      </button>
      {extraAction && (
        <button
          type="button"
          onClick={extraAction.onClick}
          aria-label={`${extraAction.label}: ${name}`}
          className="invisible text-xs font-normal text-sky-700 hover:underline group-hover:visible group-focus-within:visible"
        >
          {extraAction.label}
        </button>
      )}
      <button
        type="button"
        onClick={onAction}
        aria-label={t('budget.actionName', { action: actionLabel, name })}
        className="invisible text-xs font-normal text-red-600 hover:underline group-hover:visible group-focus-within:visible"
      >
        {actionLabel}
      </button>
      {handle}
    </span>
  );
}
