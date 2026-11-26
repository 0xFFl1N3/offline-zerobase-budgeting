/**
 * English texts: the reference list. Every key here must also exist in de.ts (the build fails otherwise).
 * {name} is filled in when shown; { one, other } picks a form by the number in {count}.
 */
export type Message = string | { one: string; other: string };

export const en = {
  // App shell
  'app.loading': 'Loading…',
  'app.version': 'Version {version}',
  'nav.budget': 'Budget',
  'nav.transactions': 'Transactions',
  'nav.analytics': 'Analytics',
  'nav.settings': 'Settings',
  'nav.due': { one: '{count} recurring transaction due', other: '{count} recurring transactions due' },
  'nav.accounts': 'Accounts',
  'nav.closeAccounts': 'Close accounts',

  // Shared
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.add': 'Add',
  'common.close': 'Close',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.rename': 'Rename',
  'common.done': 'Done',
  'common.amountPlaceholder': '0.00',
  'currency.EUR': 'Euro (EUR)',
  'currency.USD': 'US dollar (USD)',
  'language.system': 'Same as my system',

  // Setup
  'setup.title': 'Set up your budget',
  'setup.intro': 'Enter the money you have right now. You will give every bit of it a job on the next screen.',
  'setup.language': 'Language',
  'setup.accountName': 'Account name',
  'setup.defaultAccountName': 'Checking',
  'setup.balance': 'Current balance',
  'setup.currency': 'Currency',
  'setup.start': 'Start budgeting',
  'setup.errorName': 'Give the account a name.',
  'setup.errorBalance': 'Enter the current balance, e.g. 1500 or 1,500.00.',

  // Settings
  'settings.language': 'Language',
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.themeSystem': 'Same as my system',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.deviceOnly': 'Remembered on this device only; it is not part of a backup.',
  'settings.currency': 'Currency',
  'settings.currencyHint': 'Only changes how amounts are shown. Nothing is converted, so 100.00 stays 100.00.',
  'settings.clearTitle': 'Clear all data',
  'settings.clearText':
    'Deletes every account, category, goal and transaction from this browser and returns to the setup screen. This cannot be undone, so export a backup first.',
  'settings.clearButton': 'Clear all data…',
  'settings.confirmWord': 'DELETE',
  'settings.typeBefore': 'Type',
  'settings.typeAfter': 'to confirm',
  'settings.deleteEverything': 'Delete everything',
} satisfies Record<string, Message>;

export type MessageKey = keyof typeof en;
export type Messages = Record<MessageKey, Message>;
