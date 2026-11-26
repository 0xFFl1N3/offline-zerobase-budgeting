import { test } from 'node:test';
import assert from 'node:assert/strict';
import { de } from './de.ts';
import { en, type MessageKey } from './en.ts';
import { parseLanguagePreference, resolveLanguage, translate } from './i18n.ts';

test('"system" follows the first browser language the app has, English otherwise', () => {
  assert.equal(resolveLanguage('system', ['de-DE', 'en']), 'de');
  assert.equal(resolveLanguage('system', ['fr-FR', 'en-GB', 'de']), 'en');
  assert.equal(resolveLanguage('system', ['fr']), 'en');
  assert.equal(resolveLanguage('system', []), 'en');
  assert.equal(resolveLanguage('de', ['en-US']), 'de');
  assert.equal(parseLanguagePreference('xx'), 'system');
  assert.equal(parseLanguagePreference('de'), 'de');
});

test('placeholders are filled and plurals follow the count', () => {
  assert.equal(translate('en', 'nav.due', { count: 1 }), '1 recurring transaction due');
  assert.equal(translate('en', 'nav.due', { count: 3 }), '3 recurring transactions due');
  assert.equal(translate('de', 'nav.due', { count: 1 }), '1 wiederkehrende Buchung fällig');
  assert.equal(translate('de', 'nav.due', { count: 2 }), '2 wiederkehrende Buchungen fällig');
  assert.equal(translate('de', 'app.version', { version: '1.0' }), 'Version 1.0');
});

const placeholders = (m: string | { one: string; other: string }) =>
  [...new Set((typeof m === 'string' ? m : m.one + m.other).match(/\{\w+\}/g) ?? [])].sort().join(',');

test('every German text uses the same placeholders and the same plural shape as the English one', () => {
  for (const key of Object.keys(en) as MessageKey[]) {
    assert.equal(typeof de[key], typeof en[key], `${key}: one text vs. plural forms`);
    assert.equal(placeholders(de[key]), placeholders(en[key]), `${key}: placeholders differ`);
  }
});
