/**
 * Sample data for trying the app: two years of a believable household budget that end today, so the longest
 * chart range (24 months) is full. The same every time
 * apart from the dates (a fixed random seed), so screenshots and the user guide stay comparable.
 */
import { readyToAssign } from './budget.ts';
import { addDays, addMonthsClamped } from './dates.ts';
import { checkDebtRules } from './debt.ts';
import { addMonths, monthOf } from './months.ts';
import type { Account, BudgetState, Category, CategoryGroup, Goal, MonthlyBudget, RecurringTransaction, Transaction } from './types.ts';

export type DemoLanguage = 'en' | 'de';

/** Names in the demo, per language. Shop names (EDEKA, Aral, …) are the same in both. */
const NAMES = {
  en: {
    checking: 'Checking', card: 'Credit card', cash: 'Cash', savings: 'Savings account', tv: 'TV financing', anna: 'Loan from Anna',
    groups: ['Living', 'Food', 'Transport', 'Fun', 'Savings', 'Debt payments'],
    rent: 'Rent', power: 'Electricity', net: 'Internet & Phone', ins: 'Insurance', groc: 'Groceries', eat: 'Eating out',
    fuel: 'Fuel', ticket: 'Public transport', stream: 'Streaming', hobby: 'Hobbies', gifts: 'Gifts', emerg: 'Emergency fund', hol: 'Holidays',
    employer: 'Employer Ltd', salary: 'Salary', atm: 'ATM', withdrawal: 'Cash withdrawal', saving: 'Savings', interest: 'Interest',
    cardBill: 'Card bill', statement: 'Card statement {month}', presents: 'Christmas presents', insYearly: 'Home and liability, yearly',
    birthday: 'Mum’s birthday', trip: 'Lake Garda', brakes: 'Brakes', refund: 'Refund', ticketMemo: 'Monthly pass',
  },
  de: {
    checking: 'Girokonto', card: 'Kreditkarte', cash: 'Bargeld', savings: 'Tagesgeld', tv: 'Fernseher-Finanzierung', anna: 'Darlehen von Anna',
    groups: ['Wohnen', 'Essen', 'Mobilität', 'Freizeit', 'Sparen', 'Ratenzahlungen'],
    rent: 'Miete', power: 'Strom', net: 'Internet & Telefon', ins: 'Versicherungen', groc: 'Lebensmittel', eat: 'Auswärts essen',
    fuel: 'Tanken', ticket: 'Bus & Bahn', stream: 'Streaming', hobby: 'Hobbys', gifts: 'Geschenke', emerg: 'Notgroschen', hol: 'Urlaub',
    employer: 'Arbeitgeber GmbH', salary: 'Gehalt', atm: 'Geldautomat', withdrawal: 'Bargeld abgehoben', saving: 'Sparen', interest: 'Zinsen',
    cardBill: 'Kreditkartenabrechnung', statement: 'Abrechnung {month}', presents: 'Weihnachtsgeschenke', insYearly: 'Hausrat und Haftpflicht, jährlich',
    birthday: 'Geburtstag Mama', trip: 'Gardasee', brakes: 'Bremsen', refund: 'Erstattung', ticketMemo: 'Deutschlandticket',
  },
} as const;

const lastDay = (month: string) => Number(addDays(`${addMonths(month, 1)}-01`, -1).slice(8));
/** A day in a month; days past the month's end become its last day. */
const dayIn = (month: string, day: number) => `${month}-${String(Math.min(day, lastDay(month))).padStart(2, '0')}`;

/** Two years of sample data ending on `today` ('YYYY-MM-DD'). */
const MONTHS = 24;

export function buildDemo(today: string, language: DemoLanguage): BudgetState {
  const N = NAMES[language];
  let seed = 20261127;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const between = (lo: number, hi: number) => Math.round((lo + rnd() * (hi - lo)) * 100); // cents
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!;
  let n = 0;
  const id = (p: string) => `demo-${p}-${String(++n).padStart(4, '0')}`;

  const current = monthOf(today);
  const months = Array.from({ length: MONTHS }, (_, i) => addMonths(current, i - (MONTHS - 1)));
  const before = (month: string) => addMonths(month, -1);
  // The Decembers in the data (Christmas) and the next December from now (the gifts goal).
  const decembers = months.filter((m) => m.endsWith('-12'));
  /** The same month in each of the two years: `i` counts from the start of a year of data. */
  const yearly = (i: number) => [months[i]!, months[i + 12]!];
  const nextDecember = current.endsWith('-12') ? current : `${current.slice(0, 4)}-12`;

  const accounts: Account[] = [
    { id: 'acc-giro', name: N.checking, type: 'checking', openingBalance: 180000, sortOrder: 0, closed: false },
    { id: 'acc-card', name: N.card, type: 'checking', openingBalance: 0, sortOrder: 1, closed: false },
    { id: 'acc-cash', name: N.cash, type: 'cash', openingBalance: 8000, sortOrder: 2, closed: false },
    { id: 'acc-save', name: N.savings, type: 'savings', openingBalance: 300000, sortOrder: 3, closed: false },
    { id: 'acc-tv', name: N.tv, type: 'debt', openingBalance: -180000, sortOrder: 4, closed: false, paymentCategoryId: 'cat-tv', minimumPayment: 5000 },
    { id: 'acc-anna', name: N.anna, type: 'debt', openingBalance: -50000, sortOrder: 5, closed: false, paymentCategoryId: 'cat-anna' },
  ];
  const groups: CategoryGroup[] = N.groups.map((name, i) => ({ id: `grp-${i}`, name, sortOrder: i, archived: false }));
  const cat = (key: string, name: string, g: number, sortOrder: number): Category => ({ id: `cat-${key}`, groupId: `grp-${g}`, name, sortOrder, archived: false });
  const categories: Category[] = [
    cat('rent', N.rent, 0, 0), cat('power', N.power, 0, 1), cat('net', N.net, 0, 2), cat('ins', N.ins, 0, 3),
    cat('groc', N.groc, 1, 0), cat('eat', N.eat, 1, 1),
    cat('fuel', N.fuel, 2, 0), cat('ticket', N.ticket, 2, 1),
    cat('stream', N.stream, 3, 0), cat('hobby', N.hobby, 3, 1), cat('gifts', N.gifts, 3, 2),
    cat('emerg', N.emerg, 4, 0), cat('hol', N.hol, 4, 1),
    cat('tv', N.tv, 5, 0), cat('anna', N.anna, 5, 1),
  ];
  // Goals of every kind: funded each month, saving towards a date (on track and behind), and an open target.
  const goals: Goal[] = [
    { id: 'goal-rent', categoryId: 'cat-rent', type: 'monthly_amount', monthlyAmount: 95000 },
    { id: 'goal-ins', categoryId: 'cat-ins', type: 'target_balance', targetAmount: 48000, targetDate: addMonths(current, 4) },
    { id: 'goal-groc', categoryId: 'cat-groc', type: 'monthly_amount', monthlyAmount: 42000 },
    { id: 'goal-gifts', categoryId: 'cat-gifts', type: 'target_balance', targetAmount: 30000, targetDate: nextDecember },
    { id: 'goal-emerg', categoryId: 'cat-emerg', type: 'target_balance', targetAmount: 900000 },
    { id: 'goal-hol', categoryId: 'cat-hol', type: 'target_balance', targetAmount: 200000, targetDate: addMonths(current, 7) },
    { id: 'goal-tv', categoryId: 'cat-tv', type: 'monthly_amount', monthlyAmount: 5000 },
  ];

  // Assigned each month (cents).
  const plan: Record<string, number> = {
    'cat-rent': 95000, 'cat-power': 8500, 'cat-net': 4500, 'cat-ins': 4000, 'cat-groc': 42000, 'cat-eat': 9000,
    'cat-fuel': 10000, 'cat-ticket': 4900, 'cat-stream': 2600, 'cat-hobby': 6000, 'cat-gifts': 2500,
    'cat-emerg': 40000, 'cat-hol': 20000, 'cat-tv': 5000,
  };
  const monthlyBudgets: MonthlyBudget[] = [];
  for (const m of months) for (const [categoryId, assigned] of Object.entries(plan)) monthlyBudgets.push({ categoryId, month: m, assigned });
  for (const i of [18, 21]) monthlyBudgets.push({ categoryId: 'cat-anna', month: months[i]!, assigned: 10000 });
  for (const december of decembers) monthlyBudgets.find((b) => b.categoryId === 'cat-gifts' && b.month === december)!.assigned += 25000; // Christmas, on top of the plan
  // Groceries are not fully funded yet this month, so there is something for Auto-assign to do.
  monthlyBudgets.find((b) => b.categoryId === 'cat-groc' && b.month === current)!.assigned = 30000;

  const transactions: Transaction[] = [];
  const add = (date: string, accountId: string, payee: string, cents: number, categoryId: string | null, extra: Partial<Transaction> = {}) => {
    if (date > today) return;
    transactions.push({ id: id('tx'), accountId, date, payee, categoryId, memo: '', amount: cents, transferAccountId: null, ...extra });
  };
  const spend = (date: string, accountId: string, payee: string, cents: number, categoryId: string, memo = '') => add(date, accountId, payee, -cents, categoryId, { memo });
  const transfer = (date: string, from: string, to: string, payee: string, cents: number, extra: Partial<Transaction> = {}) =>
    add(date, from, payee, -cents, null, { transferAccountId: to, ...extra });

  // A streaming bill falls two days before today each month; this month's is left for the due reminder.
  const streamDay = Math.max(1, Number(today.slice(8)) - 2);

  months.forEach((m, i) => {
    add(dayIn(m, 27), 'acc-giro', N.employer, 260000, null, { memo: N.salary });
    transfer(dayIn(m, 3), 'acc-giro', 'acc-cash', N.atm, 15000, { memo: N.withdrawal });
    spend(dayIn(m, 1), 'acc-giro', 'Hausverwaltung Schmidt', 95000, 'cat-rent');
    spend(dayIn(m, 1), 'acc-giro', 'Deutsche Bahn', 4900, 'cat-ticket', N.ticketMemo);
    spend(dayIn(m, 5), 'acc-giro', 'Stadtwerke', [12, 1, 2].includes(Number(m.slice(5))) ? 9800 : 8100, 'cat-power');
    spend(dayIn(m, 6), 'acc-giro', 'Telekom', 3999, 'cat-net');
    spend(dayIn(m, 15), 'acc-card', 'Spotify', 1199, 'cat-stream');
    if (m !== current) spend(dayIn(m, streamDay), 'acc-giro', 'Netflix.com', 1399, 'cat-stream');
    add(dayIn(m, 15), 'acc-giro', N.tv, -5000, 'cat-tv', { transferAccountId: 'acc-tv' });
    for (let k = 0; k < 7; k++) spend(dayIn(m, 2 + k * 4), pick(['acc-giro', 'acc-card', 'acc-card', 'acc-cash']), pick(['EDEKA', 'REWE', 'Aldi Süd', 'Lidl', 'Wochenmarkt']), between(18, 85), 'cat-groc');
    for (let k = 0; k < 3; k++) spend(dayIn(m, 7 + k * 8), pick(['acc-cash', 'acc-card']), pick(['Pizzeria Da Mario', 'Café Klatsch', 'Döner Ecke', 'Sushi Bar']), between(9, 42), 'cat-eat');
    for (let k = 0; k < 2; k++) spend(dayIn(m, 9 + k * 12), 'acc-card', pick(['Aral', 'Shell', 'Jet']), between(45, 68), 'cat-fuel');
    spend(dayIn(m, 18), pick(['acc-card', 'acc-giro']), pick(['Thalia', 'Decathlon', 'Steam', 'Bastelladen']), between(12, 55), 'cat-hobby');
    if (i % 2 === 0) {
      const a = between(20, 40);
      const b = between(15, 35);
      add(dayIn(m, 24), 'acc-card', 'Amazon', -(a + b), null, { splits: [{ categoryId: 'cat-groc', amount: -a }, { categoryId: 'cat-hobby', amount: -b }] });
    }
    transfer(dayIn(m, 28), 'acc-giro', 'acc-save', N.saving, 30000);
    if (i % 3 === 2) add(dayIn(m, 26), 'acc-save', N.interest, 1400 + i * 100, null);
  });
  // One-offs
  for (const december of decembers) {
    spend(dayIn(december, 14), 'acc-card', 'Galeria', between(150, 210), 'cat-gifts', N.presents);
    spend(dayIn(december, 21), 'acc-cash', 'Weihnachtsmarkt', 3500, 'cat-eat');
  }
  for (const m of yearly(3)) spend(dayIn(m, 1), 'acc-giro', 'Allianz', 48000, 'cat-ins', N.insYearly);
  for (const m of yearly(5)) spend(dayIn(m, 12), 'acc-card', 'Blumen Meyer', between(35, 55), 'cat-gifts', N.birthday);
  for (const m of yearly(8)) {
    spend(dayIn(m, 4), 'acc-card', 'Booking.com', between(540, 680), 'cat-hol', N.trip);
    spend(dayIn(m, 9), 'acc-cash', 'Ristorante Al Lago', between(70, 95), 'cat-hol');
  }
  spend(dayIn(months[22]!, 3), 'acc-giro', 'Kfz-Werkstatt Huber', 34000, 'cat-emerg', N.brakes);
  add(dayIn(months[18]!, 12), 'acc-giro', 'REWE', 1250, 'cat-groc', { memo: N.refund });
  for (const i of [18, 21]) add(dayIn(months[i]!, 1), 'acc-giro', 'Anna', -10000, 'cat-anna', { transferAccountId: 'acc-anna' });
  // Each month's card purchases are paid on the 2nd of the next month.
  months.slice(1).forEach((m) => {
    const prev = before(m);
    const bill = transactions.filter((t) => t.accountId === 'acc-card' && t.transferAccountId === null && t.date.startsWith(prev)).reduce((s, t) => s - t.amount, 0);
    transfer(dayIn(m, 2), 'acc-giro', 'acc-card', N.cardBill, bill, { memo: N.statement.replace('{month}', prev) });
  });
  transactions.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  // Reconciled up to the end of last month, ticked off up to a week ago, the rest still open.
  const reconciledUntil = addDays(`${current}-01`, -1);
  const clearedUntil = addDays(today, -7);
  for (const t of transactions) {
    const status = t.date <= reconciledUntil ? 'reconciled' : t.date <= clearedUntil ? 'cleared' : 'uncleared';
    t.cleared = status;
    if (t.transferAccountId) t.transferCleared = status;
  }
  accounts[0]!.lastReconciled = reconciledUntil;

  // Recurring templates; each has handled every occurrence up to today, except the streaming bill due this month.
  const template = (t: Transaction): RecurringTransaction['template'] => {
    const { id: _i, date: _d, cleared: _c, transferCleared: _tc, importId: _ii, importPending: _ip, ...rest } = t;
    return rest;
  };
  const series = (key: string, payee: string, startDay: number, endDate: string | null = null): RecurringTransaction => {
    const startDate = dayIn(months[0]!, startDay);
    const booked = transactions.filter((t) => t.payee === payee && t.categoryId !== 'cat-anna').length;
    return { id: `rec-${key}`, template: template(transactions.find((t) => t.payee === payee)!), frequency: 'monthly', startDate, handled: booked, endDate, paused: false };
  };
  const recurring: RecurringTransaction[] = [
    series('rent', 'Hausverwaltung Schmidt', 1),
    series('salary', N.employer, 27),
    series('netflix', 'Netflix.com', streamDay),
    series('tv', N.tv, 15, addMonthsClamped(dayIn(current, 15), 12)),
    series('save', N.saving, 28),
  ];

  let state: BudgetState = { accounts, groups, categories, goals, monthlyBudgets, transactions, recurring };
  for (const t of transactions) checkDebtRules(state, t);
  // Leave 180 to assign this month: the rest went into the emergency fund in the first month.
  const first = monthlyBudgets.find((b) => b.categoryId === 'cat-emerg' && b.month === months[0])!;
  first.assigned = Math.max(0, first.assigned + readyToAssign(state, current) - 18000);
  state = { ...state, monthlyBudgets };
  return state;
}
