import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePreference, resolveTheme } from './theme.ts';

test('unknown or missing saved values mean "follow the system"', () => {
  assert.equal(parsePreference(null), 'system');
  assert.equal(parsePreference('blue'), 'system');
  assert.equal(parsePreference('dark'), 'dark');
  assert.equal(parsePreference('light'), 'light');
});

test('light and dark ignore the system; system follows it', () => {
  assert.equal(resolveTheme('light', true), 'light');
  assert.equal(resolveTheme('dark', false), 'dark');
  assert.equal(resolveTheme('system', true), 'dark');
  assert.equal(resolveTheme('system', false), 'light');
});
