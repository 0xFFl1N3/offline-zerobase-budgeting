import { useId, useState, type KeyboardEvent } from 'react';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';
import { suggestPayees, type PayeeInfo } from '../../engine/payees.ts';

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** A known payee was chosen from the list. */
  onPick: (payee: PayeeInfo) => void;
  memory: Map<string, PayeeInfo>;
  placeholder: string;
  className: string;
}

/**
 * Payee input that suggests known payees while typing. An own list rather than the browser's datalist, which looks
 * different everywhere, is covered by password managers and is awkward on phones.
 */
export function PayeeField({ value, onChange, onPick, memory, placeholder, className }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestions = open ? suggestPayees(memory, value) : [];
  const shown = suggestions.length > 0;

  const pick = (payee: PayeeInfo) => {
    onChange(payee.name);
    onPick(payee);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!shown) {
      if (e.key === 'ArrowDown' && value.trim()) setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // -1 is the field itself: moving past either end of the list returns to it.
      const slots = suggestions.length + 1;
      setActive((a) => ((a + 1 + step + slots) % slots) - 1);
    } else if (e.key === 'Enter' && active >= 0 && active < suggestions.length) {
      e.preventDefault(); // pick, do not save the form
      pick(suggestions[active]!);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  };

  return (
    <div className="relative">
      <input {...NO_AUTOFILL}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={listId}
        aria-activedescendant={shown && active >= 0 && active < suggestions.length ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setOpen(false)}
        placeholder={placeholder}
        className={className}
      />
      {shown && (
        <ul id={listId} role="listbox" className="absolute left-0 top-full z-30 mt-1 w-full min-w-48 overflow-hidden rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-slate-200">
          {suggestions.map((payee, i) => (
            <li
              key={payee.name}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: picking must happen before the field loses focus and closes the list.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(payee);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer truncate px-3 py-1.5 font-normal text-slate-900 ${i === active ? 'bg-sky-50' : ''}`}
            >
              {payee.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
