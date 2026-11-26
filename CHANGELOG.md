# Changelog

All notable changes to the budgeting app. Newest first.

## 0.6.2 – 2026-11-26

### Added
- German texts for the Transactions tab, recurring transactions and reconciling. Dates in lists are written the German way.

## 0.6.1 – 2026-11-26

### Added
- German texts for the Budget tab, goals, accounts, reordering and backups.

### Changed
- Amount fields use the language's decimal mark (250,00 in German).

## 0.6.0 – 2026-11-26

### Added
- Language setting (English or German, or the same as the system) on the setup screen and in Settings.
- Amounts and dates are written the way the chosen language writes them, e.g. 1.234,56 € in German.
- German texts for the setup screen, the navigation and Settings; the other screens follow.

## 0.5.9 – 2026-11-26

### Changed
- Shorter comment in the version file.

## 0.5.8 – 2026-11-26

### Changed
- Sync between devices is no longer planned. Data stays on each device; use Export and Import to move it.

## 0.5.7 – 2026-11-26

### Fixed
- Publishing to GitHub Pages works again.

## 0.5.6 – 2026-11-26

### Fixed
- The Budget table no longer runs off the screen on tablets in portrait.

## 0.5.5 – 2026-11-26

### Added
- The app can be installed on a phone or computer from the browser (Add to Home Screen / Install app). Once opened, it also works without internet.
- App icon.

## 0.5.4 – 2026-11-26

### Added
- Reordering on phones: a Reorder button on the Budget tab and in the accounts menu shows up and down buttons, since dragging needs a mouse.

## 0.5.3 – 2026-11-26

### Added
- Analytics on phones: charts draw at the screen's width so their labels stay readable, and the top payees list fits.

## 0.5.2 – 2026-11-26

### Added
- Transactions tab on phones: transactions show as cards (tap one to edit, repeat or delete), a round + button opens the form full-screen, and filters fold away behind a button.

### Fixed
- Phones no longer zoom in when a text field is tapped.

## 0.5.1 – 2026-11-26

### Added
- Budget tab on phones: each category shows its name, goal and available money; tap it to assign money, set a goal, rename or archive. The month, Auto-assign and Ready to Assign stay at the top while scrolling.

## 0.5.0 – 2026-11-26

### Added
- Phone layout: tabs move to a bar at the bottom, and the accounts list opens from a menu button at the top.

## 0.4.13 – 2026-11-26

### Changed
- Removed an outdated line from the README.

## 0.4.12 – 2026-11-26

### Added
- Offline version: `npm run build:single` builds the whole app into one HTML file that opens straight from disk.

## 0.4.11 – 2026-11-26

### Changed
- Shorter README description.

## 0.4.10 – 2026-11-26

### Changed
- Reworded the project description.

## 0.4.9 – 2026-11-26

### Added
- The app can be published to GitHub Pages; every push to main builds and publishes it.

## 0.4.8 – 2026-11-26

### Added
- This changelog.

## 0.4.7 – 2026-11-26

### Fixed
- Importing a newer bank export no longer duplicates payments that changed in between. A payment that was pending in the last import and is booked now updates the existing transaction.
- Status, value date and reference numbers no longer affect whether a row counts as already imported.

## 0.4.6 – 2026-11-26

### Added
- CSV import of bank transactions on the Transactions tab. Columns, separator, date format and decimal comma are detected automatically (DKB exports work as they are).
- Import preview: tick rows, edit payees, pick categories. Categories are filled in from the last one used for the payee.
- Rows already imported, or already entered by hand, are flagged and left unticked.
- PayPal payments use the shop name as payee.

## 0.4.5 – 2026-11-26

### Added
- Reconciling accounts: tick off transactions as cleared, compare with your bank statement, and lock them once they match.
- Cleared, uncleared and working balance for the selected account.
- Optional adjustment transaction when the statement and the app differ.

## 0.4.4 – 2026-11-26

### Added
- Top payees report.

## 0.4.3 – 2026-11-26

### Added
- Spending trend report for a category or group.

## 0.4.2 – 2026-11-26

### Added
- Net worth over time report.

## 0.4.1 – 2026-11-26

### Added
- Income vs. spending report.
- Time range switch for the reports over time: 6, 12 or 24 months, or all time.

## 0.4.0 – 2026-11-26

### Added
- Dark mode, with a Light / Dark / Same as my system choice in Settings.

## 0.3.2 – 2026-11-26

### Changed
- Version numbers follow the roadmap: 0.3.x is version 1, 0.4.x version 2, and so on.

## 0.3.1 – 2026-11-26

### Fixed
- The Add transaction form fits on one row again.

## 0.3.0 – 2026-11-26

### Added
- Recurring transactions: repeat weekly, every two weeks, monthly or yearly.
- Due transactions appear in a banner on the Transactions tab, with a count on the tab.
- List of recurring transactions with edit, pause and delete.

## 0.2.1 – 2026-11-26

### Added
- Recurring transactions are stored and included in backups.

## 0.2.0 – 2026-11-26

### Added
- Version number at the bottom left.

## Before 0.2.0

### Added
- Setup screen with a first account and starting balance.
- Budget tab with category groups, categories, assigning money and a month switcher. Unspent money rolls over.
- Goals: save up to an amount (optionally by a date) or set aside a monthly amount, with progress bars.
- Auto-assign button that funds every goal for the month.
- Transactions tab with outflows, inflows, transfers, split transactions, filters and a running balance.
- Accounts can be added, edited, closed and deleted.
- Rename, archive and delete groups and categories.
- Reorder accounts, groups and categories by drag and drop.
- Analytics tab with spending pie charts for this month, year to date and the monthly average.
- Export and import of all data as a backup file, with a reminder when the last backup is old.
- Settings tab with currency choice and clearing all data.

### Changed
- Every outflow needs a category.
