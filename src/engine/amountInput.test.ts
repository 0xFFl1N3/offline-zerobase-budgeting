import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSum, parseAmountInput } from './amountInput.ts';
import { parseMoney } from './money.ts';

test('anything without an operator is read exactly as before', () => {
  const inputs = [
    '12', '12,5', '12,50', '12.50', '1.234', '1,234', '1.234,56', '1,234.56', '1.234.567,89', '0,01', '-5', '-12,50', '+12,50',
    '(12,50)', '€ 12,50', '12,50 €', '$1,234.56', 'EUR 12,50', '  7 ', '', ' ', 'abc', '12,5,0', '1.234.56', '-', '+', '()', '0',
    '-0', '00012', '12,999', '1 234,56', '99999999999,99', '1e5', '12..5',
  ];
  for (const text of inputs) assert.equal(parseAmountInput(text), parseMoney(text), JSON.stringify(text));
});

test('sums with the usual order, both number styles and rounding to the cent', () => {
  const cases: [string, number][] = [
    ['100.00+2.69', 10269], ['100,00+2,69', 10269], ['100+2,69', 10269], ['3*12,99', 3897], ['3x12,99', 3897], ['3×12,99', 3897],
    ['(480-320)/5', 3200], ['480:12', 4000], ['480÷12', 4000], ['10/3', 333], ['20/3', 667], ['2+3*4', 1400], ['(2+3)*4', 2000],
    ['10*-2', -2000], ['-10+25', 1500], ['1.234,56+10', 124456], ['0,1+0,2', 30], ['100 - 2,5', 9750], ['€ 50 + 25 €', 7500],
  ];
  for (const [text, cents] of cases) assert.equal(parseAmountInput(text), cents, text);
});

test('a leading +, * or / changes the amount already in the field; a leading minus stays a negative amount', () => {
  assert.equal(parseAmountInput('+2,69', 10000), 10269);
  assert.equal(parseAmountInput('*2', 8500), 17000);
  assert.equal(parseAmountInput('/2', 8500), 4250);
  assert.equal(parseAmountInput('-5', 8500), -500, 'as before: minus five');
  assert.equal(parseAmountInput('85-50', 8500), 3500);
  assert.equal(parseAmountInput('+20', -1550), 450, 'works on a negative amount too');
  assert.equal(parseAmountInput('+2,69'), 269, 'without an amount in the field it is just a number, as before');
});

test('anything that is not a complete sum is refused', () => {
  for (const text of ['100++', '100+', '12/0', '(1+2', '1+2)', '1+a', '5*/2', '2+(3*)', '0/0']) assert.equal(parseAmountInput(text), null, text);
  assert.equal(parseAmountInput('100++', 500), null, 'also when it would change the amount in the field');
});

test('isSum tells a sum from a single amount', () => {
  assert.equal(isSum('100+2'), true);
  assert.equal(isSum('-5'), false);
  assert.equal(isSum('(12,50)'), false);
  assert.equal(isSum('1.234,56'), false);
  assert.equal(isSum('+2', 100), true);
  assert.equal(isSum('+2'), false);
});
