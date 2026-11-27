import { useState } from 'react';
import { NO_AUTOFILL } from './noAutofill.ts';

interface Props {
  label: string;
  placeholder: string;
  /** May return a promise of whether it worked; the field stays open with the name if not. */
  onAdd: (name: string) => void | Promise<boolean>;
}

/** A "+ label" button that turns into a one-line name input. */
export function InlineAdd({ label, placeholder, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const close = () => {
    setOpen(false);
    setName('');
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm text-sky-700 hover:underline">
        + {label}
      </button>
    );
  }
  return (
    <input {...NO_AUTOFILL}
      autoFocus
      value={name}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setName(e.target.value)}
      onBlur={close}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && name.trim()) {
          void Promise.resolve(onAdd(name)).then((ok) => {
            if (ok !== false) close();
          });
        }
        if (e.key === 'Escape') close();
      }}
      className="rounded border border-sky-500 px-2 py-1 text-sm focus:outline-none"
    />
  );
}
