# Changelog

All notable changes to the budgeting app, one entry per update, newest first. The short release notes shown in the app are in RELEASES.md.

## 0.18.1 – 2026-11-27

### Added
- Sums work in every amount you type: transactions and split parts, goals, reconciling, the debt plan, due recurring transactions, setup, accounts and an investment's value.
- While a sum is typed into a budget cell, the transaction amount or a goal amount, a small hint under the field shows the result ("= 102,69 €"), or "not a valid amount yet".
- A test makes sure every screen reads typed amounts this way, so a new field cannot miss it.

## 0.18.0 – 2026-11-27

### Added
- Sums in the Assigned cells: "100+2,69", "3*12,99", "(480-320)/5" are worked out when you press Enter or leave the cell. + − × ÷ can be typed as + - * / (also x and :), with brackets, in either number style. Starting with +, * or / changes the amount already there: "+2,69" adds 2,69. A leading minus still means a negative amount, as before. Something that is not a complete sum is not saved, like any invalid amount.
- Anything without an operator is read exactly as before; a test checks this across many inputs. The bank import keeps reading amounts as before.

## 0.17.1 – 2026-11-27

### Added
- The Ready to Assign pill opens a month overview (it now has a small arrow to show it can be clicked). It shows how Ready to Assign adds up: left over from last month, last month's overspending, income this month and what was assigned. Below that: what was spent, what all categories hold, what goals still need (with "Fund goals" right there), and net worth at the end of the month. On phones it opens the same way.

### Changed
- The red note about last month's overspending moved from under the pill into the overview, with a line explaining it.

## 0.17.0 – 2026-11-27

### Added
- The month summary is worked out for any month: what was left to assign last month, last month's overspending, money that came in this month, what was assigned, and what was spent and is still available in the categories. Not on screen yet. A test checks that the parts always add up to Ready to Assign, in every month of the sample data and with archived categories, overspending and money moving out of an investment.

## 0.16.3 – 2026-11-27

### Changed
- Tidier accounts list: each section's total sits in its heading ("Accounts €18,211.00", "Debts −€900.00", "Investments €8,111.10") instead of in a separate total row with a line above it, and the sections are set apart by space rather than lines.

## 0.16.2 – 2026-11-27

### Added
- The sample data has an ETF portfolio outside the budget: 100 € a month from an "ETF savings plan" category (with a monthly goal), and a change in value every three months.

### Changed
- Bookings inside a debt or an investment (a correction, a change in value) are labelled "Outside the budget" instead of "No category" or "Income", and no longer show up under the "Income" and "No category" filters.
- Restoring a backup checks debts and investments with the same rules as saving does, instead of a separate copy of them.

## 0.16.1 – 2026-11-27

### Added
- "Investment (not in budget)" when adding an account, with a short note on what it means. Such accounts get their own section in the accounts list ("Investments") with a total, and are left out of the accounts total and of Ready to Assign.
- Editing an investment account has "Current value" with "Update value": the difference to today's value is booked as a change in value.
- A transfer from a budget account into an investment asks for the category the money comes from, and is refused without one ("Choose the category the money comes from …"). In the list it shows as "Category → Investment".

### Changed
- Investment accounts are not offered for expenses, income or the bank import, like debts.

## 0.16.0 – 2026-11-27

### Added
- A new kind of account for money kept outside the budget (investments, a pension, a building-society plan): its balance is not in Ready to Assign but counts towards net worth. Money moved into it from a budget account always comes from a category, never straight from Ready to Assign; money moved out of it into a budget account is income. Transactions inside it (changes in value) have no category, and reconciling it books the difference without one. It cannot be turned into a budget account or a debt. Not yet in the app's screens; stored, checked in backups and covered by tests.

### Fixed
- Statistics: correcting a debt downwards counted as income in "Income and spending", and raising a debt counted as spending without a category. Changes inside a debt (or a tracking account) are now neither.

## 0.15.3 – 2026-11-27

### Added
- A one-time goal whose month has passed says so instead of showing a progress bar: "Due in March 2027 · done", or "· 180,00 € still missing" if the money was not there in time. Below it: "Repeat yearly" (turns it into a yearly goal in one click), "New goal…" (opens the editor with the same amount and no month) and "Remove goal". On phones these show when you tap the category.

## 0.15.2 – 2026-11-27

### Changed
- In the sample data, the insurance goal (due every year in the month of the insurance bill) and the gifts goal (due every December) repeat yearly.

## 0.15.1 – 2026-11-27

### Added
- The goal editor has a "Repeats" choice (once, every 3 months, every 6 months, every year), shown once a month is set. The goal line shows the month it is aiming at now and how often it repeats, e.g. "320,00 € of 480,00 € by March 2027 · yearly".

## 0.15.0 – 2026-11-27

### Fixed
- A "save up to an amount" goal with a month asked for the whole amount again once the bill had been paid: in the due month itself, and every month after it. Now the due month only checks whether the money was there before the bill took it, and after the due month a goal that was met asks for nothing more. One that was not met keeps asking for what is missing.
- Overspending in a goal's category no longer raises what the goal asks for the next month; like everywhere else, it is taken from Ready to Assign.

### Added
- Goals with a month can repeat every 3, 6 or 12 months: after each due month they aim at the next one and start over by themselves. Money left over after a cheaper bill counts towards the next round. Not yet in the goal editor; stored, checked in backups and used by Auto-assign.

## 0.14.2 – 2026-11-27

### Changed
- The payee field and the bank import now share one payee memory instead of two with slightly different rules. From the import's: purchases and refunds remember their categories separately, and a payment to a debt suggests the debt's payment category. From the payee field's: case and extra spaces do not matter, so "REWE  Markt" in a bank file finds "rewe markt".
- A category that has been archived is skipped for the one used before it, rather than suggesting nothing.

## 0.14.1 – 2026-11-27

### Added
- Choosing a payee you have used before fills in the category from last time, and switches between expense and income if needed (choosing your employer makes it income). This also happens when you type the payee out in full and leave the field.
- It never replaces a category you already chose, leaves splits and transfers alone, and skips a category that has been archived since.

## 0.14.0 – 2026-11-27

### Added
- The payee field suggests payees you have used before while you type: names starting with what you typed first, then names containing it, the most used first. Arrow keys and Enter pick one, Escape closes the list, and a new name can still be typed. Case and extra spaces do not matter ("rewe" finds "REWE").
- The suggestions are worked out from your transactions, so nothing new is stored and they are right after an import, an undo or a restore.

## 0.13.0 – 2026-11-27

### Added
- Auto-assign is now a menu with three ways to fill categories, each showing up front how much it would assign:
  - Fund goals: what the button did before, gives each goal what it needs this month.
  - Cover overspending: brings every red category back to zero, with or without a goal.
  - Same as last month: categories with nothing assigned yet this month get what they got last month.
- An entry with nothing to do says why in the menu itself ("No category is in the minus."), instead of only in a tooltip. If an entry would assign more than is left, it asks first.
- The menu works with the keyboard (arrow keys, Escape) and closes on a click elsewhere.

### Changed
- In German the button is now called "Zuweisen"; "Ziele auffüllen" is one of its entries.

## 0.12.5 – 2026-11-27

### Fixed
- Auto-assign turned grey when every goal was already met, and the reason was only in a tooltip, which phones never show. The button now stays clickable: with nothing to do it looks muted, and clicking it says "Nothing to assign: every goal is already funded this month."

## 0.12.4 – 2026-11-27

### Fixed
- In the sample data every goal was already met this month, so Auto-assign had nothing to do and stayed grey. Groceries now get €300 of their €420 this month, so Auto-assign can fill the missing €120.

## 0.12.3 – 2026-11-27

### Changed
- The sample data now covers two years instead of one, so the 24-month view in Statistics is full. Yearly things (insurance, holiday, a birthday, Christmas) happen in both years. The TV financing starts higher so it is still being paid off, the salary is a little lower so the savings stay believable, and the fuel budget is a bit tight so overspending shows up.

## 0.12.2 – 2026-11-27

### Added
- While the app holds sample data, a bar at the top says so ("You are looking at sample data") with a button "Set up my own budget". After a confirmation it deletes the sample data and opens the setup screen.
- Automatic backups are off while trying the app with sample data, so the backup folder never fills with made-up budgets. Settings says so on the Automatic backup card.

## 0.12.1 – 2026-11-27

### Added
- The setup screen has a second button, "Try with sample data", that fills the app with the sample data in the language chosen above. It goes through the same checks as restoring a backup.
- The app remembers that its data is sample data, also after a reload. A backup of the sample data comes back as sample data; restoring any other backup, setting up a budget or deleting all data ends it.

## 0.12.0 – 2026-11-27

### Added
- Sample data for trying the app: a year of a believable household budget that ends today, with names in English or German. Accounts (including a credit card used as an ordinary account and two debts), goals of every kind, some overspending, reconciled and open transactions, and a recurring payment that is due. It comes out the same every time apart from the dates. Not reachable in the app yet; tests check it passes the same checks as a backup import, for dates across month ends, February and the turn of the year.

## 0.11.14 – 2026-11-27

### Changed
- All forms now use one shared form component that always stops the browser's own submit. Without it, a form submitted by the browser would reload the page and put what was typed into the address bar. A test fails if a plain form is added anywhere else.

## 0.11.13 – 2026-11-27

### Fixed
- LastPass still offered passwords in amount fields: newer versions are reported to ignore their own "ignore" marker. Fields now also carry a name LastPass is reported to skip.
- When a password manager put its icon next to an assigned amount in the budget, the row's Activity and Available moved one place over and onto a second line. Each amount field now has its own box, so such icons stay inside it.

## 0.11.12 – 2026-11-27

### Fixed
- The note under Ready to Assign showed a double minus ("Lowered by -€0.49"). It now reads "Lowered by €0.49 …".

## 0.11.11 – 2026-11-27

### Fixed
- Password managers such as LastPass took some amount fields, like the assigned amount in the budget, for password fields and offered to fill them. Every field in the app now tells the browser and the common password managers (LastPass, 1Password, Bitwarden, Dashlane) that it is not a sign-in field. A test makes sure new fields do the same.

## 0.11.10 – 2026-11-27

### Added
- Charts move smoothly to their new state instead of jumping. On a new time period the months slide to their place, the axis rescales, and months that come or go move in or out at the edge. Pie slices change size in place; slices that are no longer there shrink away. The change takes about a third of a second.
- With "reduce motion" turned on in the system settings, charts change instantly as before.

## 0.11.9 – 2026-11-27

### Changed
- The transaction list shows the newest 100 transactions at first, with a "Show 100 more" button below. Filters, search, the count and the totals still cover all transactions. Changing a filter starts again at 100. This keeps the list quick with years of data.

## 0.11.8 – 2026-11-27

### Fixed
- Transactions without a category showed "Income (goes to Ready to Assign)" in the list. The list says "Income" again; the longer text is only used where you pick a category.

## 0.11.7 – 2026-11-27

### Changed
- The "What's new" notes for 0.11 are now a short overview: a tidier look and clearer wording.

## 0.11.6 – 2026-11-27

### Changed
- Went through every German text and reworded the ones that were hard to understand at first glance (English adjusted where it had the same problem):
  - "Anfangsbestand" is now "Kontostand beim Anlegen", matching "Restschuld beim Anlegen" for debts.
  - The running balance column and the reconcile panel say "Kontostand" instead of "Saldo".
  - Reconciling: "Der Kontoauszug zeigt 30,00 € mehr als der bestätigte Kontostand." instead of a sentence without a subject.
  - The red note under Ready to Assign now says why it is lower: "Um 40,00 € verringert, weil im Oktober mehr ausgegeben als zugewiesen wurde."
  - The income choice in the category list reads "Einnahme (geht an „Noch zuzuweisen“)" instead of using an arrow.
  - The recurrence field is labelled "Wiederholung", and the make-recurring form starts with "… regelmäßig buchen ab …", matching the row action.
  - The payee placeholder shows an example ("z. B. Bäcker") instead of just "Wer".
  - Debt messages no longer use the term "Budgetkonto"; they say "normales Konto (Girokonto, Bargeld, Sparkonto)".
  - Debt plan: "Einmalige Sondertilgung", "abbezahlt im März 2027", "noch 5 Raten, die letzte über 80,00 € im März 2027", and the group picker reads "Raten-Kategorie anlegen in".
  - Smaller fixes: the restore question lists counts without "Konto/Konten", unlocking a reconciled transaction explains what happens, the age-of-money hint reads more smoothly, "Startdatum" instead of "erstes Datum", clearer CSV import hints, and consistent spacing before "…".

## 0.11.5 – 2026-11-27

### Changed
- Clearer button and label texts:
  - Age of money: last month's value is now its own sentence under the number ("A month ago it was 145 days." / "Vor einem Monat waren es 145 Tage.") instead of "vor einem Monat: 145 Tage".
  - The button that undoes a split now reads "Cancel split" / "Aufteilung aufheben" (was "Single" / "Nicht aufteilen").
  - The row action that turns a transaction into a recurring one now reads "Make recurring…" / "Regelmäßig buchen …" (was "Repeat…" / "Wiederholen …").
  - Due recurring transactions: "Confirm" / "Bestätigen" is now "Add now" / "Jetzt buchen".

## 0.11.4 – 2026-11-27

### Fixed
- Reconciling, in German: the hint about the adjustment was not a proper sentence. The amount now sits inside the sentence where each language puts it ("…wird beim Abschließen eine Korrektur von 30,00 € gebucht.").
- The message after reconciling names the adjustment in a sentence of its own instead of tacking it onto the locked transactions.

## 0.11.3 – 2026-11-27

### Changed
- German texts reviewed: "Statistiken" instead of "Auswertungen", "Backup" instead of "Sicherung", "Restschuld" for what is still owed on a debt, "Umsätze" for the Activity column, "Ratenzahlungen" as the default group for debt payments, and clearer wording in a number of other places (closing the account list on phones, reconciling, recurring transactions, the bank import, raising or correcting a debt).
- Net worth is described as all account balances minus debts.

### Fixed
- Two German sentences had the wrong word order (reconciling, Age of money).
- Amount fields in the split rows and the payoff calculator showed "0.00" as a hint in German too; they now follow the language.

## 0.11.2 – 2026-11-27

### Fixed
- Budget: while moving a group, the drop line was drawn under the target group's heading, as if the group could be dropped into it. It is now drawn in the gap between the group cards.

## 0.11.1 – 2026-11-27

### Changed
- Transactions: the recurring list can be folded away by clicking its heading (remembered on this device); folded, it shows which one is next. The list is sorted by next date, with paused and ended ones last, and its columns line up. On phones each entry shows name and amount, then what and when, then the actions.

## 0.11.0 – 2026-11-27

### Changed
- Budget: each category group is its own card, with space between groups and thin lines between categories. The column labels sit above the cards as plain text instead of in a header bar.

## 0.10.11 – 2026-11-27

### Fixed
- Importing a backup that assigns money to the same category twice in one month is refused with a message. Before, one of the two amounts was silently dropped. Backups made by the app never contain this; only hand-made files could.

## 0.10.10 – 2026-11-27

### Changed
- Budget: categories without a goal show just their name. "Set goal" appears next to Archive/Delete when you point at the row, instead of sitting at a different spot on every row.

## 0.10.9 – 2026-11-27

### Changed
- "What changed" (the version number) now shows short release notes per release from RELEASES.md instead of this full changelog. The "New" tag only appears when the notes change, not on every update.

## 0.10.8 – 2026-11-27

### Changed
- "Record payment" moved from the Budget into the debt's payoff plan. The line under a debt's category (what's left, when it's paid off) opens the plan.

## 0.10.7 – 2026-11-27

### Added
- When adding a debt, choose the group its payment category goes into. "Debt payments" is the default and is created if it doesn't exist yet.

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
