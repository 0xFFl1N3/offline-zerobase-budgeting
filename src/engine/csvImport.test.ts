import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectSeparator, parseCsv } from './csv.ts';
import { cleanPayee, detectDateFormat, findMatches, findTable, guessMapping, parseDate, payeeMemory, readRows, suggestCategory, toTransactions } from './csvImport.ts';
import type { BudgetState, Transaction } from './types.ts';

// Shaped like a DKB "Girokonto" export; names and numbers are made up.
const DKB = [
  '﻿"Girokonto";"DE00123456780000000000"',
  '""',
  '"Kontostand vom 26.11.2026:";"1.234,98 €"',
  '""',
  '"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"',
  '"26.11.26";"26.11.26";"Gebucht";"ISSUER";"EDEKA";"VISA Debitkartenumsatz vom 25.11.2026";"Ausgang";"DE00111";"-12,81";"";"";"111"',
  '"26.11.26";"26.11.26";"Gebucht";"Kontoinhaber";"PayPal Europe S.a.r.l. et Cie S.C.A";"Ihr Einkauf bei Netflix.com";"Ausgang";"DE00222";"-21,99";"";"M1";"222"',
  '"25.11.26";"25.11.26";"Vorgemerkt";"ISSUER";"EDEKA";"VISA Debitkartenumsatz vom 24.11.2026";"Ausgang";"DE00111";"-9,87";"";"";"333"',
  '"24.11.26";"24.11.26";"Gebucht";"Arbeitgeber GmbH";"Max Mustermann";"Gehalt November";"Eingang";"DE00333";"2.500,00";"";"";""',
  '"24.11.26";"24.11.26";"Gebucht";"ISSUER";"SOFTWARE.SHOP.LLC/SHOP.EXAMPLE";"VISA Debitkartenumsatz; Fremdwährung 17,84 USD";"Ausgang";"DE00444";"-16,4";"";"";"444"',
].join('\r\n');

const table = () => findTable(parseCsv(DKB))!;

test('CSV: separator detection, quotes, doubled quotes and line breaks inside quotes', () => {
  assert.equal(detectSeparator('a;b;c\n1;2;3'), ';');
  assert.equal(detectSeparator('a,b,c\n1,2,3'), ',');
  assert.equal(detectSeparator('a\tb\n1\t2'), '\t');
  assert.deepEqual(parseCsv('a,"b, ""quoted""",c\n"multi\nline",2,3\n\n'), [
    ['a', 'b, "quoted"', 'c'],
    ['multi\nline', '2', '3'],
  ]);
  // A separator inside quotes does not split (the software shop row above has one).
  assert.equal(parseCsv(DKB).at(-1)!.length, 12);
});

test('the table is found below the account details, with the stated balance', () => {
  const t = table();
  assert.equal(t.header[0], 'Buchungsdatum');
  assert.equal(t.rows.length, 5);
  assert.deepEqual(t.statedBalance, { amount: 123498, date: '2026-11-26' });
  assert.equal(findTable([['just', 'some', 'text']]), null);
});

test('the mapping is guessed from German column names', () => {
  assert.deepEqual(guessMapping(table()), {
    date: 0, amount: 8, inflow: null, outflow: null, payee: 4, payer: 3, memo: 5, status: 2, dateFormat: 'DMY',
  });
  const en = findTable(parseCsv('Date,Description,Debit,Credit\n11/26/2026,Coffee,3.50,\n11/27/2026,Salary,,2000.00'))!;
  const m = guessMapping(en);
  assert.equal(m.amount, null);
  assert.equal(m.outflow, 2);
  assert.equal(m.inflow, 3);
  assert.equal(m.dateFormat, 'MDY');
  assert.deepEqual(readRows(en, { ...m, payee: 1 }).map((r) => [r.date, r.payee, r.amount]), [
    ['2026-11-26', 'Coffee', -350],
    ['2026-11-27', 'Salary', 200000],
  ]);
});

test('dates in all three orders, two-digit years, impossible dates rejected', () => {
  assert.equal(parseDate('26.11.26', 'DMY'), '2026-11-26');
  assert.equal(parseDate('2026-11-26', 'YMD'), '2026-11-26');
  assert.equal(parseDate('11/26/2026', 'MDY'), '2026-11-26');
  assert.equal(parseDate('31.04.2026', 'DMY'), null);
  assert.equal(parseDate('soon', 'DMY'), null);
  assert.equal(detectDateFormat(['05/06/2026', '13/06/2026']), 'DMY');
  assert.equal(detectDateFormat(['05/06/2026', '06/13/2026']), 'MDY');
});

test('rows: payer for inflows, payee for outflows, PayPal shop names, pending status, stable import ids', () => {
  const rows = readRows(table(), guessMapping(table()));
  assert.deepEqual(rows.map((r) => [r.date, r.payee, r.amount, r.pending, r.problem]), [
    ['2026-11-26', 'EDEKA', -1281, false, null],
    ['2026-11-26', 'Netflix.com', -2199, false, null],
    ['2026-11-25', 'EDEKA', -987, true, null],
    ['2026-11-24', 'Arbeitgeber GmbH', 250000, false, null],
    ['2026-11-24', 'SOFTWARE.SHOP.LLC/SHOP.EXAMPLE', -1640, false, null],
  ]);
  assert.equal(new Set(rows.map((r) => r.importId)).size, 5);
  assert.deepEqual(readRows(table(), guessMapping(table())).map((r) => r.importId), rows.map((r) => r.importId));
  assert.equal(cleanPayee('PayPal Europe', 'Tilia LLC, Ihr Einkauf bei Tilia LLC'), 'Tilia LLC');
  assert.equal(cleanPayee('  REWE   Markt ', 'x'), 'REWE Markt');
});

test('identical rows in one file get different ids; bad rows say why', () => {
  const t = findTable(parseCsv('Datum;Name;Betrag\n01.11.2026;Cafe;-3,00\n01.11.2026;Cafe;-3,00\n32.11.2026;Cafe;-1\n02.11.2026;Cafe;abc'))!;
  const rows = readRows(t, guessMapping(t));
  assert.notEqual(rows[0]!.importId, rows[1]!.importId);
  assert.equal(rows[2]!.problem, 'No valid date');
  assert.equal(rows[3]!.problem, 'No valid amount');
});

const state = (transactions: Transaction[]): BudgetState => ({
  accounts: [
    { id: 'a', name: 'Giro', type: 'checking', openingBalance: 0, sortOrder: 0, closed: false },
    { id: 'b', name: 'Cash', type: 'cash', openingBalance: 0, sortOrder: 1, closed: false },
  ],
  groups: [{ id: 'g', name: 'Living', sortOrder: 0, archived: false }],
  categories: [
    { id: 'food', groupId: 'g', name: 'Groceries', sortOrder: 0, archived: false },
    { id: 'tv', groupId: 'g', name: 'Streaming', sortOrder: 1, archived: false },
    { id: 'old', groupId: 'g', name: 'Old', sortOrder: 2, archived: true },
  ],
  goals: [], recurring: [], monthlyBudgets: [], transactions,
});
const t = (extra: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(), accountId: 'a', date: '2026-11-01', payee: '', categoryId: null, memo: '', amount: -100, transferAccountId: null, ...extra,
});

test('matches: earlier imports by id, hand-entered ones by amount within three days, each used once', () => {
  const rows = readRows(table(), guessMapping(table()));
  const s = state([
    t({ importId: rows[0]!.importId, amount: -1281, date: '2026-11-26' }),
    t({ amount: -2199, date: '2026-11-23' }), // Netflix entered by hand, three days earlier
    t({ amount: -987, date: '2026-11-20' }), // too far away
    t({ accountId: 'b', amount: -1640, date: '2026-11-24' }), // another account
    t({ importId: 'csv:other', amount: -1640, date: '2026-11-24' }), // a different bank row
  ]);
  assert.deepEqual([...findMatches(s, 'a', rows)], [[0, 'imported'], [1, 'likely']]);
});

test('payee memory suggests the last category per payee, separately for refunds, skipping archived ones', () => {
  const memory = payeeMemory(state([
    t({ payee: 'EDEKA', categoryId: 'food', date: '2026-10-01' }),
    t({ payee: 'edeka ', categoryId: 'tv', date: '2026-09-01' }), // older
    t({ payee: 'Netflix.com', categoryId: 'old' }),
    t({ payee: 'EDEKA', categoryId: 'tv', amount: 500 }), // a refund
  ]));
  assert.equal(suggestCategory(memory, 'Edeka', -1), 'food');
  assert.equal(suggestCategory(memory, 'EDEKA', 1), 'tv');
  assert.equal(suggestCategory(memory, 'Netflix.com', -1), null);
});

test('import builds cleared transactions (pending ones not cleared) and requires a category on outflows', () => {
  const rows = readRows(table(), guessMapping(table()));
  let n = 0;
  const txs = toTransactions(
    [
      { row: rows[0]!, payee: 'Edeka', categoryId: 'food' },
      { row: rows[2]!, payee: 'EDEKA', categoryId: 'food' },
      { row: rows[3]!, payee: 'Arbeitgeber GmbH', categoryId: null },
    ],
    'a',
    () => `n${n++}`,
  );
  assert.deepEqual(txs.map((x) => [x.id, x.payee, x.amount, x.cleared, x.categoryId, x.importId === rows[x === txs[0] ? 0 : x === txs[1] ? 2 : 3]!.importId]), [
    ['n0', 'Edeka', -1281, 'cleared', 'food', true],
    ['n1', 'EDEKA', -987, undefined, 'food', true],
    ['n2', 'Arbeitgeber GmbH', 250000, 'cleared', null, true],
  ]);
  assert.throws(() => toTransactions([{ row: rows[0]!, payee: 'x', categoryId: null }], 'a', () => 'z'), /needs a category/);
});
