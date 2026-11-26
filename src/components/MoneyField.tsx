import { useRef, useState } from 'react';
import { parseMoney } from '../engine/money.ts';
import type { Cents } from '../engine/types.ts';

const toText = (cents: Cents) => (cents / 100).toFixed(2);

interface Props {
  value: Cents;
  onCommit: (cents: Cents) => void;
  ariaLabel: string;
  className?: string;
}

/** Text field for an amount. Commits on Enter or blur, reverts on Escape or invalid input. */
export function MoneyField({ value, onCommit, ariaLabel, className = '' }: Props) {
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
    <input
      inputMode="decimal"
      aria-label={ariaLabel}
      className={`rounded border border-transparent bg-transparent px-2 py-1 text-right tabular-nums hover:border-slate-300 focus:border-sky-500 focus:bg-white focus:outline-none ${className}`}
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
