# Changelog

All notable changes to the budgeting app. Newest first.

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
