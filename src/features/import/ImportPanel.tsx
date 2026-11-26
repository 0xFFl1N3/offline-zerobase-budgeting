import { useMemo, useState, type ChangeEvent } from 'react';
import { parseCsv } from '../../engine/csv.ts';
import {
  DATE_FORMAT_LABELS,
  findMatches,
  findTable,
  guessMapping,
  payeeMemory,
  readRows,
  suggestCategory,
  toTransactions,
  updateFromRow,
  type ColumnMapping,
  type CsvTable,
  type DateFormat,
  type ImportRow,
} from '../../engine/csvImport.ts';
import { formatMoney } from '../../engine/money.ts';
import { accountBalances } from '../../engine/reconcile.ts';
import { categoryLabel } from '../transactions/labels.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';

const field = 'rounded border border-slate-300 bg-white px-2 py-1 text-sm';

/** Bank files are UTF-8 or, from older German banks, Windows-1252. */
async function readText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

/** The mapping chosen last time for a file with the same columns, remembered on this device. */
const mappingKey = (table: CsvTable) => `csv-mapping:${table.header.join('|')}`;
function loadMapping(table: CsvTable): ColumnMapping {
  try {
    const saved = localStorage.getItem(mappingKey(table));
    if (saved) return { ...guessMapping(table), ...(JSON.parse(saved) as ColumnMapping) };
  } catch {
    /* fall back to the guess */
  }
  return guessMapping(table);
}
function saveMapping(table: CsvTable, mapping: ColumnMapping) {
  try {
    localStorage.setItem(mappingKey(table), JSON.stringify(mapping));
  } catch {
    /* not remembered; that's fine */
  }
}

interface Choice {
  include: boolean;
  payee: string;
  categoryId: string | null;
}

export function ImportPanel({ defaultAccountId, onClose }: { defaultAccountId: string | null; onClose: (message?: string) => void }) {
  const state = useBudgetStore((s) => s.state);
  const currency = useBudgetStore((s) => s.currency);
  const importTransactions = useBudgetStore((s) => s.importTransactions);
  const fmt = (c: number) => formatMoney(c, currency);

  const accounts = state.accounts.filter((a) => !a.closed);
  const [accountId, setAccountId] = useState(defaultAccountId && accounts.some((a) => a.id === defaultAccountId) ? defaultAccountId : (accounts[0]?.id ?? ''));
  const [fileName, setFileName] = useState('');
  const [table, setTable] = useState<CsvTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [overrides, setOverrides] = useState<Map<number, Choice>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    const found = findTable(parseCsv(await readText(file)));
    if (!found) {
      setTable(null);
      return setError('No transactions found in this file. It needs a header row followed by rows that start with a date.');
    }
    setFileName(file.name);
    setTable(found);
    setMapping(loadMapping(found));
    setOverrides(new Map());
  };

  const changeMapping = (patch: Partial<ColumnMapping>) => {
    if (!table || !mapping) return;
    const next = { ...mapping, ...patch };
    setMapping(next);
    saveMapping(table, next);
    setOverrides(new Map());
  };

  const rows = useMemo(() => (table && mapping ? readRows(table, mapping) : []), [table, mapping]);
  const matches = useMemo(() => findMatches(state, accountId, rows), [state, accountId, rows]);
  const memory = useMemo(() => payeeMemory(state), [state]);

  const choiceFor = (row: ImportRow): Choice =>
    overrides.get(row.line) ?? {
      include: row.problem === null && (!matches.has(row.line) || matches.get(row.line)!.kind === 'update'),
      payee: row.payee,
      categoryId: row.amount === null ? null : suggestCategory(memory, row.payee, row.amount),
    };
  const setChoice = (row: ImportRow, patch: Partial<Choice>) =>
    setOverrides((m) => new Map(m).set(row.line, { ...choiceFor(row), ...patch }));

  const updateOf = (row: ImportRow) => {
    const m = matches.get(row.line);
    return m?.kind === 'update' ? state.transactions.find((t) => t.id === m.transactionId) : undefined;
  };
  const chosen = rows.filter((r) => r.problem === null && choiceFor(r).include);
  const chosenNew = chosen.filter((r) => !updateOf(r));
  const chosenUpdates = chosen.filter((r) => updateOf(r));
  const missing = chosenNew.filter((r) => r.amount! < 0 && choiceFor(r).categoryId === null).length;
  // Updated pending payments are already in the balance.
  const chosenTotal = chosenNew.reduce((t, r) => t + r.amount!, 0);

  const runImport = () => {
    try {
      const added = toTransactions(
        chosenNew.map((row) => ({ row, payee: choiceFor(row).payee, categoryId: choiceFor(row).categoryId })),
        accountId,
        () => crypto.randomUUID(),
      );
      const updated = chosenUpdates.map((row) => updateFromRow(updateOf(row)!, row));
      const name = state.accounts.find((a) => a.id === accountId)?.name ?? '';
      const parts = [
        added.length > 0 ? `imported ${added.length} transaction${added.length === 1 ? '' : 's'}` : '',
        updated.length > 0 ? `updated ${updated.length} pending one${updated.length === 1 ? '' : 's'}` : '',
      ].filter(Boolean).join(' and ');
      void importTransactions([...added, ...updated]).then(() => onClose(`${parts.charAt(0).toUpperCase()}${parts.slice(1)} in ${name}.`));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The import failed.');
    }
  };

  const columnSelect = (label: string, value: number | null, onChange: (v: number | null) => void, optional = true) => (
    <label className="text-xs font-medium text-slate-600">
      {label}
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={`${field} mt-1 block max-w-44`}
      >
        {optional && <option value="">(none)</option>}
        {table!.header.map((h, i) => (
          <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
        ))}
      </select>
    </label>
  );

  const categorySelect = (row: ImportRow, choice: Choice) => (
    <select
      aria-label={`Category for ${choice.payee || 'row ' + (row.line + 1)}`}
      value={choice.categoryId ?? ''}
      onChange={(e) => setChoice(row, { categoryId: e.target.value || null, include: true })}
      className={`rounded border px-2 py-1 text-sm w-full ${choice.include && row.amount! < 0 && choice.categoryId === null ? 'border-amber-300 bg-amber-50' : 'border-slate-300 bg-white'}`}
    >
      <option value="">{row.amount! > 0 ? 'Income (Ready to Assign)' : 'Choose a category…'}</option>
      {state.groups.filter((g) => !g.archived).map((g) => (
        <optgroup key={g.id} label={g.name}>
          {state.categories.filter((c) => c.groupId === g.id && !c.archived).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );

  const note = (row: ImportRow) => {
    if (row.problem) return <span className="text-red-600">{row.problem}</span>;
    const match = matches.get(row.line);
    if (match?.kind === 'imported') return <span className="text-slate-500">Already imported</span>;
    if (match?.kind === 'update') {
      return (
        <span className="text-sky-700" title="Imported earlier while pending; importing updates that transaction instead of adding a new one">
          {row.pending ? 'Updates the pending one' : 'Now booked: updates the pending one'}
        </span>
      );
    }
    if (match?.kind === 'likely') return <span className="text-amber-700" title="A transaction with the same amount within three days is already in this account">Possible duplicate</span>;
    if (row.pending) return <span className="text-slate-500" title="Imported as not cleared">Pending</span>;
    return null;
  };

  const amountsReady = mapping !== null && (mapping.amount !== null || (mapping.inflow !== null && mapping.outflow !== null));
  const importable = rows.filter((r) => r.problem === null);

  return (
    <div className="mt-4 rounded-lg bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Import from your bank (CSV)</h2>
        <button type="button" onClick={() => onClose()} className="text-sm text-slate-600 hover:underline">Close</button>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">
          Into account
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${field} mt-1 block`}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          File
          <input
            type="file"
            accept=".csv,.txt,text/csv"
            onChange={(e) => void onFile(e)}
            className="mt-1 block text-sm file:mr-3 file:rounded file:border-0 file:bg-sky-600 file:px-3 file:py-1 file:text-white"
          />
        </label>
        {fileName && <span className="pb-1 text-sm text-slate-600">{fileName}: {rows.length} rows</span>}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {table && mapping && (
        <>
          <details className="mt-3 rounded border border-slate-200 p-3" open={!amountsReady || mapping.payee === null}>
            <summary className="cursor-pointer text-sm text-slate-700">Columns (detected automatically, remembered for files like this)</summary>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              {columnSelect('Date', mapping.date, (v) => changeMapping({ date: v ?? 0 }), false)}
              <label className="text-xs font-medium text-slate-600">
                Date format
                <select value={mapping.dateFormat} onChange={(e) => changeMapping({ dateFormat: e.target.value as DateFormat })} className={`${field} mt-1 block`}>
                  {(Object.keys(DATE_FORMAT_LABELS) as DateFormat[]).map((f) => (
                    <option key={f} value={f}>{DATE_FORMAT_LABELS[f]}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-medium text-slate-600">
                Amount
                <select
                  value={mapping.amount ?? 'split'}
                  onChange={(e) =>
                    e.target.value === 'split'
                      ? changeMapping({ amount: null, inflow: mapping.inflow ?? 0, outflow: mapping.outflow ?? 0 })
                      : changeMapping({ amount: Number(e.target.value), inflow: null, outflow: null })
                  }
                  className={`${field} mt-1 block max-w-44`}
                >
                  {table.header.map((h, i) => (
                    <option key={i} value={i}>{h || `Column ${i + 1}`}</option>
                  ))}
                  <option value="split">Separate in and out columns</option>
                </select>
              </label>
              {mapping.amount === null && (
                <>
                  {columnSelect('Money in', mapping.inflow, (v) => changeMapping({ inflow: v }))}
                  {columnSelect('Money out', mapping.outflow, (v) => changeMapping({ outflow: v }))}
                </>
              )}
              {columnSelect('Payee', mapping.payee, (v) => changeMapping({ payee: v }))}
              {columnSelect('Payer (money in)', mapping.payer, (v) => changeMapping({ payer: v }))}
              {columnSelect('Memo', mapping.memo, (v) => changeMapping({ memo: v }))}
              {columnSelect('Status', mapping.status, (v) => changeMapping({ status: v }))}
            </div>
          </details>

          <div className="mt-3 max-h-[28rem] overflow-auto rounded border border-slate-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-8 px-2 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select all importable rows"
                      checked={chosen.length > 0 && chosen.length === importable.length}
                      onChange={(e) => {
                        const next = new Map(overrides);
                        for (const r of importable) next.set(r.line, { ...choiceFor(r), include: e.target.checked });
                        setOverrides(next);
                      }}
                    />
                  </th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Payee</th>
                  <th className="px-2 py-2">Memo</th>
                  <th className="w-48 px-2 py-2">Category</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const choice = choiceFor(row);
                  const off = row.problem !== null || !choice.include;
                  return (
                    <tr key={row.line} className={`border-b border-slate-100 last:border-b-0 ${off ? 'text-slate-400' : ''}`}>
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          aria-label={`Import row ${row.line + 1}`}
                          disabled={row.problem !== null}
                          checked={!off}
                          onChange={(e) => setChoice(row, { include: e.target.checked })}
                        />
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">{row.date ?? '—'}</td>
                      <td className="px-2 py-1.5">
                        {updateOf(row) ? (
                          <span className="px-2">{updateOf(row)!.payee}</span>
                        ) : (
                        <input
                          aria-label={`Payee for row ${row.line + 1}`}
                          value={choice.payee}
                          onChange={(e) => setChoice(row, { payee: e.target.value })}
                          className={`${field} w-full min-w-32`}
                        />
                        )}
                      </td>
                      <td className="max-w-64 truncate px-2 py-1.5 text-slate-500" title={row.memo}>{row.memo}</td>
                      <td className="px-2 py-1.5">
                        {row.problem === null && (updateOf(row) ? <span className="text-slate-500">{categoryLabel(state, updateOf(row)!)}</span> : categorySelect(row, choice))}
                      </td>
                      <td className={`px-2 py-1.5 text-right whitespace-nowrap tabular-nums ${row.amount !== null && row.amount > 0 && !off ? 'text-emerald-700' : ''}`}>
                        {row.amount === null ? '—' : fmt(row.amount)}
                      </td>
                      <td className="px-2 py-1.5 text-xs whitespace-nowrap">{note(row)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {table.statedBalance && (
            <p className="mt-2 text-xs text-slate-500">
              The file gives a bank balance of {fmt(table.statedBalance.amount)}
              {table.statedBalance.date ? ` on ${table.statedBalance.date}` : ''}. After this import the account's working balance would be{' '}
              {fmt(accountBalances(state, accountId).working + chosenTotal)}.
            </p>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={chosen.length === 0 || missing > 0}
              onClick={runImport}
              className="rounded bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              Import {chosen.length} transaction{chosen.length === 1 ? '' : 's'}
            </button>
            <span className="text-sm text-slate-600" role="status">
              {missing > 0 ? (
                <span className="text-amber-700">{missing} outflow{missing === 1 ? ' needs' : 's need'} a category first.</span>
              ) : chosen.length > 0 ? (
                `${chosenNew.length > 0 ? `New: ${fmt(chosenTotal)}. ` : ''}Booked rows come in as cleared, pending ones as not cleared.`
              ) : (
                'Tick the rows to import.'
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
