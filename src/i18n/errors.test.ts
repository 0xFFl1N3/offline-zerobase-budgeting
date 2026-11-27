import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorText } from './errors.ts';
import { setLanguagePreference } from './i18n.ts';

test('known messages are translated, row problems keep their number, unknown ones are kept or framed', () => {
  setLanguagePreference('de');
  try {
    assert.equal(errorText(new Error('An account with transactions cannot be deleted. Close it instead.')), 'Ein Konto mit Buchungen lässt sich nicht löschen. Schließe es stattdessen.');
    assert.equal(errorText('Row 3: No valid date.'), 'Zeile 3: Kein gültiges Datum.');
    assert.equal(errorText(new Error('Row 7 needs a category.')), 'Zeile 7 braucht eine Kategorie.');
    assert.equal(errorText('Something odd'), 'Something odd');
    assert.equal(errorText('Goal: unknown type "x".', 'error.backupInvalid'), 'Die Datei ist kein gültiges Backup (Goal: unknown type "x".).');
    assert.equal(errorText(undefined), 'Etwas ist schiefgegangen.');
  } finally {
    setLanguagePreference('en');
  }
  assert.equal(errorText('Goal: unknown type "x".', 'error.backupInvalid'), 'Goal: unknown type "x".');
  assert.equal(errorText(new Error('Row 3: No valid date.')), 'Row 3: No valid date.');
});
