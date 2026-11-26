import { RANGES, type RangeKey } from '../../engine/reports.ts';
import { t } from '../../i18n/i18n.ts';

export function RangeSwitch({ value, onChange }: { value: RangeKey; onChange: (range: RangeKey) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-slate-300" role="group" aria-label={t('analytics.timeRange')}>
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          aria-pressed={value === r.key}
          className={`whitespace-nowrap px-2 py-1.5 text-sm sm:px-3 ${value === r.key ? 'bg-sky-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
        >
          {t(`range.${r.key}`)}
        </button>
      ))}
    </div>
  );
}
