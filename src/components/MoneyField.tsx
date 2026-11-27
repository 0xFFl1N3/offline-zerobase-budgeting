import { useRef, useState } from 'react';
import { parseMoney, toAmountInput } from '../engine/money.ts';
import type { Cents } from '../engine/types.ts';
import { NO_AUTOFILL } from './noAutofill.ts';

const toText = (cents: Cents) => toAmountInput(cents);

interface Props {
  value: Cents;
  onCommit: (cents: Cents) => void;
  ariaLabel: string;
  className?: string;
  /** Always show the field's border and background (phones have no hover to reveal it). */
  boxed?: boolean;
}

/** Text field for an amount. Commits on Enter or blur, reverts on Escape or invalid input. */
export function MoneyField({ value, onCommit, ariaLabel, className = '', boxed = false }: Props) {
  const [text, setText] = useState<string | null>(null); // null = not editing
  const cancelled = useRef(false);

  const finish = () => {
    if (!cancelled.current && text !== null) {
      const cents = parseMoney(text);
      if (cents !== null && cents !== value) onCommit(cents);
    }
    cancelled.current = false;
    setText(null);
  };

  return (
    <input {...NO_AUTOFILL}
      inputMode="decimal"
      aria-label={ariaLabel}
      className={`rounded border px-2 py-1 text-right tabular-nums hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:outline-none ${boxed ? 'border-slate-300 bg-white' : 'border-transparent bg-transparent'} ${className}`}
      value={text ?? toText(value)}
      onFocus={(e) => {
        setText(toText(value));
        e.currentTarget.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={finish}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
