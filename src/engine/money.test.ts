import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, parseMoney } from './money.ts';

test('parseMoney handles common formats', () => {
  assert.equal(parseMoney('12.50'), 1250);
  assert.equal(parseMoney('12,50'), 1250);
  assert.equal(parseMoney('1.234,56'), 123456);
  assert.equal(parseMoney('1,234.56'), 123456);
  assert.equal(parseMoney('1,234'), 123400);
  assert.equal(parseMoney('5'), 500);
  assert.equal(parseMoney('0.5'), 50);
  assert.equal(parseMoney('-5'), -500);
  assert.equal(parseMoney('(5.00)'), -500);
  assert.equal(parseMoney('€ 3'), 300);
  assert.equal(parseMoney('-0'), 0);
});

test('parseMoney rejects invalid input', () => {
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('abc'), null);
  assert.equal(parseMoney('1.234.56'), null);
  assert.equal(parseMoney('--'), null);
});

test('formatMoney formats cents', () => {
  assert.equal(formatMoney(123456, 'USD', 'en-US'), '$1,234.56');
  assert.equal(formatMoney(-500, 'USD', 'en-US'), '-$5.00');
});
