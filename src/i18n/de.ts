import type { Messages } from './en.ts';

/** German texts (informal "du"). Keys and {placeholders} match en.ts. */
export const de: Messages = {
  // App shell
  'app.loading': 'Wird geladen …',
  'app.version': 'Version {version}',
  'nav.budget': 'Budget',
  'nav.transactions': 'Buchungen',
  'nav.analytics': 'Auswertungen',
  'nav.settings': 'Einstellungen',
  'nav.due': { one: '{count} wiederkehrende Buchung fällig', other: '{count} wiederkehrende Buchungen fällig' },
  'nav.accounts': 'Konten',
  'nav.closeAccounts': 'Konten schließen',

  // Shared
  'common.cancel': 'Abbrechen',
  'common.save': 'Speichern',
  'common.add': 'Hinzufügen',
  'common.close': 'Schließen',
  'common.delete': 'Löschen',
  'common.edit': 'Bearbeiten',
  'common.rename': 'Umbenennen',
  'common.done': 'Fertig',
  'common.amountPlaceholder': '0,00',
  'currency.EUR': 'Euro (EUR)',
  'currency.USD': 'US-Dollar (USD)',
  'language.system': 'Wie mein System',

  // Setup
  'setup.title': 'Richte dein Budget ein',
  'setup.intro': 'Gib das Geld ein, das du gerade hast. Auf dem nächsten Bildschirm gibst du jedem Euro eine Aufgabe.',
  'setup.language': 'Sprache',
  'setup.accountName': 'Kontoname',
  'setup.defaultAccountName': 'Girokonto',
  'setup.balance': 'Aktueller Kontostand',
  'setup.currency': 'Währung',
  'setup.start': 'Los geht’s',
  'setup.errorName': 'Gib dem Konto einen Namen.',
  'setup.errorBalance': 'Gib den aktuellen Kontostand ein, z. B. 1500 oder 1.500,00.',

  // Settings
  'settings.language': 'Sprache',
  'settings.appearance': 'Darstellung',
  'settings.theme': 'Design',
  'settings.themeSystem': 'Wie mein System',
  'settings.themeLight': 'Hell',
  'settings.themeDark': 'Dunkel',
  'settings.deviceOnly': 'Wird nur auf diesem Gerät gespeichert und ist nicht Teil einer Sicherung.',
  'settings.currency': 'Währung',
  'settings.currencyHint': 'Ändert nur, wie Beträge angezeigt werden. Es wird nichts umgerechnet, 100,00 bleibt 100,00.',
  'settings.clearTitle': 'Alle Daten löschen',
  'settings.clearText':
    'Löscht alle Konten, Kategorien, Ziele und Buchungen aus diesem Browser und führt zurück zur Einrichtung. Das lässt sich nicht rückgängig machen, also exportiere vorher eine Sicherung.',
  'settings.clearButton': 'Alle Daten löschen …',
  'settings.confirmWord': 'LÖSCHEN',
  'settings.typeBefore': 'Gib',
  'settings.typeAfter': 'ein, um zu bestätigen',
  'settings.deleteEverything': 'Alles löschen',
};
