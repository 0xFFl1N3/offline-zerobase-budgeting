import { useState } from 'react';
import { alreadyInBudget, planSuggestions, sameName, suggestions, type GroupPick } from '../../engine/suggestions.ts';
import { useLanguage, useT } from '../../i18n/i18n.ts';
import { useBudgetStore } from '../../store/budgetStore.ts';
import { useNavigation } from '../../store/navigation.ts';
import { useAction } from '../errors/useAction.ts';
import { NO_AUTOFILL } from '../../components/noAutofill.ts';
import { Form } from '../../components/Form.tsx';

/**
 * Suggested groups to tick; a ticked group opens its categories, the usual ones ticked. Groups and categories
 * already in the budget show ticked and greyed out, so opening this again adds only what is new.
 */
export function Suggestions({ firstRun }: { firstRun: boolean }) {
  const t = useT();
  const language = useLanguage();
  const state = useBudgetStore((s) => s.state);
  const addSuggestions = useBudgetStore((s) => s.addSuggestions);
  const setStart = useNavigation((s) => s.setStart);
  const { run, error } = useAction();
  const list = suggestions(language);

  const inBudget = (group: string) => state.groups.some((g) => !g.archived && sameName(g.name, group));
  /** Ticked groups (by id) and, per group, its ticked categories including own ones typed in. */
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set(list.filter((g) => inBudget(g.name)).map((g) => g.id)));
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [own, setOwn] = useState<Record<string, string[]>>({});

  // A new group starts with its usual categories ticked; one already in the budget with nothing extra, so opening
  // this again does not bring back categories that were left out on purpose.
  const tickedIn = (id: string) => {
    const group = list.find((g) => g.id === id)!;
    return picked[id] ?? (inBudget(group.name) ? [] : group.categories.filter((c) => c.usual).map((c) => c.name));
  };
  const toggleGroup = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toggleCategory = (id: string, name: string) => {
    const now = tickedIn(id);
    setPicked({ ...picked, [id]: now.includes(name) ? now.filter((n) => n !== name) : [...now, name] });
  };

  const picks: GroupPick[] = list.filter((g) => open.has(g.id)).map((g) => ({ group: g.name, categories: tickedIn(g.id) }));
  const count = planSuggestions(state, picks).groups.reduce((n, g) => n + g.categories.length, 0);
  // Right after setup, the mid-month question comes next; from the budget it goes straight back.
  const create = () => void run(() => addSuggestions(picks)).then((ok) => ok && setStart(firstRun ? { step: 'midMonth', firstRun: true } : null));

  return (
    <main className="mx-auto max-w-2xl px-3 pt-8 pb-28 md:pt-16">
      <h1 className="text-2xl font-semibold">{t('suggest.title')}</h1>
      <p className="mt-2 text-sm text-slate-600">{t('suggest.intro')}</p>
      <div className="mt-6 space-y-3">
        {list.map((group) => {
          const isOpen = open.has(group.id);
          const existing = inBudget(group.name);
          const ticked = tickedIn(group.id);
          const names = [...group.categories.map((c) => c.name), ...(own[group.id] ?? [])];
          return (
            <section key={group.id} className="overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
              <label className={`flex items-center gap-3 px-4 py-3 ${existing ? '' : 'cursor-pointer hover:bg-slate-50'}`}>
                <input {...NO_AUTOFILL} type="checkbox" className="tick" checked={isOpen} disabled={existing} onChange={() => toggleGroup(group.id)} />
                <span className="flex-1 font-semibold">{group.name}</span>
                {!isOpen && <span className="truncate text-xs text-slate-500">{group.categories.slice(0, 3).map((c) => c.name).join(', ')} …</span>}
              </label>
              {isOpen && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {names.map((name) => {
                      const has = alreadyInBudget(state, group.name, name);
                      return (
                        <label key={name} className={`flex items-center gap-2.5 rounded px-1 py-1 text-sm ${has ? 'text-slate-500' : 'cursor-pointer hover:bg-slate-50'}`}>
                          <input {...NO_AUTOFILL} type="checkbox" className="tick" checked={has || ticked.includes(name)} disabled={has} onChange={() => toggleCategory(group.id, name)} />
                          {name}
                        </label>
                      );
                    })}
                  </div>
                  <OwnCategory
                    group={group.name}
                    onAdd={(name) => {
                      if (!names.some((n) => sameName(n, name))) setOwn({ ...own, [group.id]: [...(own[group.id] ?? []), name] });
                      if (!ticked.some((n) => sameName(n, name))) setPicked({ ...picked, [group.id]: [...ticked, name] });
                    }}
                  />
                </div>
              )}
            </section>
          );
        })}
      </div>
      {/* Stays at the bottom of the window while the list scrolls. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3">
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
          <button
            type="button"
            disabled={count === 0}
            onClick={create}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-default disabled:opacity-50"
          >
            {count === 0 ? t('suggest.nothing') : t('suggest.create', { count })}
          </button>
          <button type="button" onClick={() => setStart(firstRun ? { step: 'choose', firstRun: true } : null)} className="text-sm text-slate-600 hover:underline">
            {firstRun ? t('common.back') : t('common.cancel')}
          </button>
        </div>
      </div>
    </main>
  );
}

/** A field for an own category with an Add button (phones have no obvious Enter); Enter works too. */
function OwnCategory({ group, onAdd }: { group: string; onAdd: (name: string) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  return (
    <Form
      onSubmit={() => {
        if (!name.trim()) return;
        onAdd(name.trim());
        setName('');
      }}
      className="mt-2 flex gap-2"
    >
      <input {...NO_AUTOFILL}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('suggest.ownCategory')}
        aria-label={t('suggest.ownCategoryIn', { group })}
        enterKeyHint="done"
        className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm sm:max-w-64"
      />
      <button type="submit" disabled={!name.trim()} className="rounded border border-sky-600 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-40">
        {t('suggest.ownAdd')}
      </button>
    </Form>
  );
}
