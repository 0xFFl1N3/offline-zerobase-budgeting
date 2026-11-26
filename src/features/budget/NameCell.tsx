interface Props {
  name: string;
  renaming: boolean;
  onStartRename: () => void;
  onRename: (name: string) => void;
  onCancelRename: () => void;
  onDelete: () => void;
}

/** A group or category name with Rename and Delete actions that appear on hover or keyboard focus. */
export function NameCell({ name, renaming, onStartRename, onRename, onCancelRename, onDelete }: Props) {
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
      <span>{name}</span>
      <span className="invisible inline-flex gap-2 text-xs font-normal group-hover:visible group-focus-within:visible">
        <button type="button" onClick={onStartRename} aria-label={`Rename ${name}`} className="text-sky-700 hover:underline">Rename</button>
        <button type="button" onClick={onDelete} aria-label={`Delete ${name}`} className="text-red-600 hover:underline">Delete</button>
      </span>
    </span>
  );
}
