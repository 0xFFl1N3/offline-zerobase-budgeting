# Changelog

All notable changes to the budgeting app. Newest first.

## 0.10.6 – 2026-11-27

### Fixed
- Deleting a debt said its balance would be removed from Ready to Assign, which debts are not part of. It now says that the debt's payment category stays in the budget.

## 0.10.5 – 2026-11-27

### Fixed
- Reconciling a debt could change Ready to Assign. The difference now only changes what is owed, and no category is asked for.
- Debt payments made in the app were listed with the payee "Transfer"; they are now named after the debt.
- On phones, moving an account up or down sometimes did nothing when debts were listed. Accounts and debts now move within their own list.
- With a debt selected in Transactions, payments were counted as outflow in the totals line; they now count as inflow, as in the list.

## 0.10.4 – 2026-11-27

### Added
- In a debt's payoff plan: "Owe more" adds to what is owed (another purchase on the same financing, a fee), and "Correct the balance" sets it to what the lender says. Neither touches the budget.
- Paying more than is still owed asks before saving.
- A debt at zero shows "Paid off" in the accounts list, the Budget and its payoff plan. Close or archive it yourself when you like.

## 0.10.3 – 2026-11-27

### Added
- Payoff plan for debts: how much is still owed, how many payments are left and when the last one is, with a calculator to try another monthly amount or a one-time extra payment, and a chart of what was paid back so far. Open it from the line under the debt's category in the Budget, or from the debt in the accounts list.

## 0.10.2 – 2026-11-27

### Added
- Paying a debt: a transfer from a budget account to a debt asks for a category, already set to the debt's own. The payment is spent from that category and lowers what is owed.
- "Record payment" on a debt's category in the Budget opens the form filled in with this month's amount.
- Choosing a debt's category for an outflow, typed in or in the CSV import, books it as a payment to that debt. The import remembers it for the payee.

## 0.10.1 – 2026-11-27

### Added
- Debt accounts: choose "Debt" when adding an account and enter what is still to pay back and, optionally, the minimum monthly payment. The debt gets its own category under "Debt payments" to budget the payments in, with the minimum payment as its monthly goal.
- Debts are listed separately in the accounts list, with the total owed. They don't count toward Ready to Assign.

## 0.10.0 – 2026-11-27

### Added
- Groundwork for debt accounts: the budget, reports, filters, Age of money and backups now understand debts and payments to them. Debts can be added from 0.10.1.

## 0.9.3 – 2026-11-27

### Fixed
- With the app open in several tabs, a change in one now shows up in the others right away. Before, Undo, importing a backup or the automatic backup in one tab could overwrite changes made in another.
- Only one tab runs the automatic backup, and it saves what is actually stored.
- If a newer version of the app is opened in another tab, older tabs ask you to reload instead of saving with old code.

## 0.9.2 – 2026-11-27

### Fixed
- Filling the budget automatically, saving a goal and removing a goal are now saved all at once or not at all, so a failure can't leave half a change behind.

## 0.9.1 – 2026-11-27

### Changed
- Forms keep what you typed when a change can't be saved, so you can just try again.
- A storage error is no longer shown twice (in the red bar and next to the form).
- The red bar goes away by itself once saving works again.

## 0.9.0 – 2026-11-27

### Added
- When a change can't be saved (storage full, storage blocked, or anything unexpected), a red bar says so instead of the change silently not appearing.
- If the budget can't be opened at all, the app explains why instead of showing "Loading…" forever.

## 0.8.2 – 2026-11-27

### Fixed
- Publishing the website could fail when a failed run was started again.

## 0.8.1 – 2026-11-26

### Added
- Click the version number (bottom left, or in the accounts menu on phones) to see what changed. After an update it shows a "New" tag until you have looked, and the new versions are marked in the list.

## 0.8.0 – 2026-11-26

### Added
- Undo: after deleting a transaction, account, category, group, recurring transaction or goal, a bar offers to undo it for 10 seconds. Only the latest delete can be undone, and only until the next change.

## 0.7.4 – 2026-11-26

### Added
- Analytics: click a pie slice, a name in its list, or a top payee to open Transactions filtered to it for the same period.

## 0.7.3 – 2026-11-26

### Added
- Age of money on the Analytics tab: how many days your money sat in your accounts before you spent it, averaged over your last 10 payments, with a chart of how it changed.

## 0.7.2 – 2026-11-26

### Added
- CSV import: after picking a category for a row, a link offers to use it for the other rows from the same payee that have no category yet. Rows you already set are left alone.

## 0.7.1 – 2026-11-26

### Added
- Automatic backup (Chrome and Edge on a computer): choose a folder once in Settings, and the app saves a backup file there once a day while it is open. The last 10 files are kept.

## 0.7.0 – 2026-11-26

### Added
- The app asks the browser to keep its data permanently, so it is not cleared when disk space runs low. Settings shows whether the browser agreed, how much space the data uses, and how to improve it if not.

## 0.6.6 – 2026-11-26

### Changed
- Overspending works like YNAB: an overspent category starts the next month at zero, and the shortfall comes out of that month's Ready to Assign. A note under Ready to Assign says how much was overspent the month before. Money left over in a category still rolls over as before.

## 0.6.5 – 2026-11-26

### Fixed
- Closing an account or archiving a category now pauses the recurring transactions that use it (the confirmation names them). Before, they kept booking into the hidden account or category and Ready to Assign dropped without a visible reason.
- A due recurring transaction that points to a closed account or an archived category can no longer be confirmed; the banner explains why.

## 0.6.4 – 2026-11-26

### Fixed
- Names in a few English messages are in double quotes again.
- On phones, the last transaction is no longer hidden behind the round + button.

## 0.6.3 – 2026-11-26

### Added
- German texts for the CSV import, Analytics, and the messages shown when something can't be done (for example closing an account that still has money).

### Changed
- Percentages follow the language (67,6 % in German).
- The chart hint mentions tapping, for phones.

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
