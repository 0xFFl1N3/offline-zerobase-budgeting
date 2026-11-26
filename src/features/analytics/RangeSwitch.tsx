import { RANGES, type RangeKey } from '../../engine/reports.ts';

export function RangeSwitch({ value, onChange }: { value: RangeKey; onChange: (range: RangeKey) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-slate-300" role="group" aria-label="Time range">
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          aria-pressed={value === r.key}
          className={`px-3 py-1.5 text-sm ${value === r.key ? 'bg-sky-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
