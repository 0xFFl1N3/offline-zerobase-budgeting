import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTransaction, toForm, type TxForm } from './buildTransaction.ts';

const form = (over: Partial<TxForm> = {}): TxForm => ({
  kind: 'outflow',
  date: '2026-01-10',
  accountId: 'chk',
  payee: ' Landlord ',
  categoryId: 'rent',
  transferAccountId: null,
  memo: '',
  amount: 90000,
  ...over,
});

test('outflow becomes a negative amount', () => {
  const r = buildTransaction(form(), 'id1');
  assert.ok(r.ok);
  assert.equal(r.transaction.amount, -90000);
  assert.equal(r.transaction.payee, 'Landlord');
  assert.equal(r.transaction.categoryId, 'rent');
});

test('inflow without category is income', () => {
  const r = buildTransaction(form({ kind: 'inflow', categoryId: null }), 'id2');
  assert.ok(r.ok);
  assert.equal(r.transaction.amount, 90000);
  assert.equal(r.transaction.categoryId, null);
});

test('transfer drops the category and records the destination', () => {
  const r = buildTransaction(form({ kind: 'transfer', transferAccountId: 'sav', payee: '' }), 'id3');
  assert.ok(r.ok);
  assert.equal(r.transaction.amount, -90000);
  assert.equal(r.transaction.categoryId, null);
  assert.equal(r.transaction.transferAccountId, 'sav');
  assert.equal(r.transaction.payee, 'Transfer');
});

test('invalid forms are rejected', () => {
  assert.equal(buildTransaction(form({ amount: 0 }), 'x').ok, false);
  assert.equal(buildTransaction(form({ date: '' }), 'x').ok, false);
  assert.equal(buildTransaction(form({ accountId: '' }), 'x').ok, false);
  assert.equal(buildTransaction(form({ kind: 'transfer', transferAccountId: null }), 'x').ok, false);
  assert.equal(buildTransaction(form({ kind: 'transfer', transferAccountId: 'chk' }), 'x').ok, false);
});

test('an outflow must have a category, an inflow need not', () => {
  const outflow = buildTransaction(form({ categoryId: null }), 'x');
  assert.equal(outflow.ok, false);
  if (!outflow.ok) assert.match(outflow.error, /category/);
  assert.equal(buildTransaction(form({ kind: 'inflow', categoryId: null }), 'x').ok, true);
});

test('toForm reverses buildTransaction', () => {
  for (const f of [form(), form({ kind: 'inflow', categoryId: null }), form({ kind: 'transfer', transferAccountId: 'sav', categoryId: null, payee: 'Transfer' }), form({ categoryId: null, splits: [{ categoryId: 'a', amount: 40000 }, { categoryId: 'b', amount: 50000 }] })]) {
    const r = buildTransaction(f, 'id');
    assert.ok(r.ok);
    assert.deepEqual(toForm(r.transaction), { ...f, payee: f.payee.trim(), splits: f.splits ?? null });
  }
});

test('a split outflow stores negative parts that add up to the total', () => {
  const r = buildTransaction(form({ categoryId: null, amount: 5000, splits: [{ categoryId: 'food', amount: 3000 }, { categoryId: 'home', amount: 2000 }] }), 's1');
  assert.ok(r.ok);
  assert.equal(r.transaction.amount, -5000);
  assert.equal(r.transaction.categoryId, null);
  assert.deepEqual(r.transaction.splits, [{ categoryId: 'food', amount: -3000 }, { categoryId: 'home', amount: -2000 }]);
  assert.deepEqual(toForm(r.transaction).splits, [{ categoryId: 'food', amount: 3000 }, { categoryId: 'home', amount: 2000 }]);
});

test('invalid splits are refused', () => {
  const split = (splits: TxForm['splits']) => buildTransaction(form({ amount: 5000, splits }), 's');
  const bad = (r: ReturnType<typeof split>, pattern: RegExp) => { assert.equal(r.ok, false); assert.match(!r.ok ? r.error : '', pattern); };
  bad(split([{ categoryId: 'food', amount: 5000 }]), /at least two/);
  bad(split([{ categoryId: 'food', amount: 3000 }, { categoryId: null, amount: 2000 }]), /category for every part/);
  bad(split([{ categoryId: 'food', amount: 5000 }, { categoryId: 'home', amount: 0 }]), /greater than zero/);
  bad(split([{ categoryId: 'food', amount: 3000 }, { categoryId: 'home', amount: 1000 }]), /add up/);
});
