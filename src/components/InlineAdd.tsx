import { useState } from 'react';

interface Props {
  label: string;
  placeholder: string;
  onAdd: (name: string) => void;
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
    <input
      autoFocus
      value={name}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setName(e.target.value)}
      onBlur={close}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && name.trim()) {
          onAdd(name);
          close();
        }
        if (e.key === 'Escape') close();
      }}
      className="rounded border border-sky-500 px-2 py-1 text-sm focus:outline-none"
    />
  );
}
