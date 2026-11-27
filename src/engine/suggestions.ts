import type { BudgetState } from './types.ts';

/** A suggested category; `usual` ones are ticked when their group is ticked. */
export interface SuggestedCategory {
  name: string;
  usual: boolean;
}

export interface SuggestedGroup {
  /** Stable across languages, for keys and tests. */
  id: string;
  name: string;
  categories: SuggestedCategory[];
}

type Lang = 'en' | 'de';

/** [id, English, German, then the categories as [English, German, usual]; '' leaves one out of that language]. */
const LIST: [string, string, string, [string, string, boolean][]][] = [
  ['living', 'Living', 'Wohnen', [
    ['Rent', 'Miete', true],
    ['Groceries', 'Lebensmittel', true],
    ['Electricity', 'Strom', true],
    ['Utilities', 'Nebenkosten', true],
    ['Internet', 'Internet', true],
    ['Mobile data', 'Handy', true],
    ['', 'Rundfunkbeitrag', true],
    ['Household', 'Haushalt', false],
    ['Drugstore', 'Drogerie', false],
  ]],
  ['transport', 'Transport', 'Mobilität', [
    ['Fuel', 'Tanken', true],
    ['Public transport', 'ÖPNV', true],
    ['Car insurance', 'Kfz-Versicherung', false],
    ['Car tax', 'Kfz-Steuer', false],
    ['Repairs and service', 'Werkstatt', false],
    ['Parking', 'Parken', false],
    ['Taxi', 'Taxi', false],
  ]],
  ['insurance', 'Insurance', 'Versicherungen', [
    ['Liability', 'Haftpflicht', true],
    ['Contents', 'Hausrat', true],
    ['Legal', 'Rechtsschutz', false],
    ['Dental', 'Zahnzusatz', false],
    ['Disability', 'Berufsunfähigkeit', false],
    ['Life', 'Risikolebensversicherung', false],
  ]],
  ['savings', 'Savings', 'Rücklagen', [
    ['Emergency fund', 'Notgroschen', true],
    ['Holidays', 'Urlaub', true],
    ['Big purchases', 'Anschaffungen', false],
    ['Next car', 'Nächstes Auto', false],
    ['Investing', 'Geldanlage', false],
  ]],
  ['lifestyle', 'Lifestyle', 'Freizeit', [
    ['Eating out', 'Essen gehen', true],
    ['Going out with friends', 'Unternehmungen mit Freunden', true],
    ['Hobbies', 'Hobbys', false],
    ['Gaming', 'Gaming', false],
    ['Clothes', 'Kleidung', false],
    ['Hair and care', 'Friseur und Pflege', false],
    ['Fun money', 'Taschengeld', false],
  ]],
  ['exercise', 'Exercise', 'Sport', [
    ['Gym', 'Fitnessstudio', true],
    ['Sports club', 'Sportverein', false],
    ['Sports gear', 'Sportausrüstung', false],
    ['Classes', 'Kurse', false],
  ]],
  ['subscriptions', 'Subscriptions', 'Abos', [
    ['Video streaming', 'Streaming', true],
    ['Music', 'Musik', true],
    ['Cloud storage', 'Cloud-Speicher', false],
    ['News', 'Zeitung und Magazine', false],
    ['Apps and software', 'Apps und Software', false],
  ]],
  ['learning', 'Self-improvement', 'Weiterbildung', [
    ['Books', 'Bücher', true],
    ['Courses', 'Kurse und Seminare', false],
    ['Languages', 'Sprachen lernen', false],
  ]],
  ['giving', 'Giving', 'Schenken und Spenden', [
    ['Birthdays', 'Geburtstage', true],
    ['Christmas', 'Weihnachten', true],
    ['Donations', 'Spenden', false],
  ]],
];

/** The suggested groups and categories in the app's language. */
export function suggestions(language: Lang): SuggestedGroup[] {
  const pick = (en: string, de: string) => (language === 'de' ? de : en);
  return LIST.map(([id, en, de, cats]) => ({
    id,
    name: pick(en, de),
    categories: cats.map(([cen, cde, usual]) => ({ name: pick(cen, cde), usual })).filter((c) => c.name !== ''),
  }));
}

/** Names compare without case and extra spaces, so "Rent" and " rent " are the same category. */
export const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();

export interface GroupPick {
  group: string;
  categories: string[];
}

/** What picking adds: per group, whether it is new and which of its categories are new. Nothing that exists twice. */
export interface SuggestionPlan {
  groups: { name: string; existingId: string | null; categories: string[] }[];
}

/**
 * Turns the ticked suggestions (and typed own categories) into what has to be created. A group that already exists
 * (same name, not archived) gets only the categories it does not have yet; doubles within the picks are dropped;
 * groups that would end up adding nothing are left out.
 */
export function planSuggestions(state: BudgetState, picks: GroupPick[]): SuggestionPlan {
  const groups: SuggestionPlan['groups'] = [];
  for (const pick of picks) {
    if (!pick.group.trim()) continue;
    const existing = state.groups.find((g) => !g.archived && sameName(g.name, pick.group));
    const have = existing ? state.categories.filter((c) => c.groupId === existing.id && !c.archived).map((c) => c.name) : [];
    const categories: string[] = [];
    for (const raw of pick.categories) {
      const name = raw.trim().replace(/\s+/g, ' ');
      if (name && ![...have, ...categories].some((n) => sameName(n, name))) categories.push(name);
    }
    if (categories.length === 0) continue;
    groups.push({ name: existing ? existing.name : pick.group.trim(), existingId: existing?.id ?? null, categories });
  }
  return { groups };
}

/** Whether a suggested category is already in the budget (shown ticked and greyed out). */
export function alreadyInBudget(state: BudgetState, group: string, category: string): boolean {
  const g = state.groups.find((x) => !x.archived && sameName(x.name, group));
  return g !== undefined && state.categories.some((c) => c.groupId === g.id && !c.archived && sameName(c.name, category));
}
