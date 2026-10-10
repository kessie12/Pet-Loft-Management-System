# Hybrid database setup

## Storage and editable settings

The app reads/writes these existing Google Sheets tabs directly: **Master Booking**, **Customer & Pet Directory**, and **Store Credit**. Payments are fields on bookings. Unpaid balances are derived, not a second payment ledger. D1 holds configuration and account/security/coordination metadata; it does not hold copies of bookings, customers, pets or credit transactions. R2 stores private receipt files.

Boss Settings provides service prices (including grooming tiers/add-ons), receipt titles/layout/footer/document prefixes, room types, physical kennels, assignment rules, individual logins and staff credit permissions. Other existing booking, deposit, opening-hours and shop/bank controls remain available. A new D1 database starts from the repository defaults. Previous browser-only settings and demo password hashes are not imported automatically; review the shop configuration in Boss Settings before live use. Changes to fields in the main settings view stay as a draft until Save is selected. Dedicated kennel/account/receipt/grooming price editors have their own Save actions.

Boarding Rooms supplies each room type's price, capacity and description. Physical Kennels maps actual kennel numbers to those room types. The room matrix derives its displayed capacity/price from this same configuration and its occupancy from bookings. Assignment rules can impose a lower sharing limit and preferred kennels; they cannot increase physical/type capacity. Room changes that would invalidate existing open reservations are rejected. Renaming/deleting a physical kennel requires updating its preferred-room rules and affected reservations first. Editing prices changes future quotes; it does not reprice existing bookings.

## 1. Cloudflare resources

1. Install dependencies using Node 24: `npm ci`.
2. Create a D1 database named `mellow_pet_loft_db` in your Cloudflare account. Put its actual ID in `wrangler.toml` in place of `your-d1-database-id-here`.
3. Apply the additive migration: `npm run db:migrate:remote`. For isolated local testing use `npm run db:migrate:local` instead. Do not run an old destructive schema/reset script. Existing legacy tables, if any, are left intact but are no longer the active business-record database.
4. Create a private R2 bucket named `mellow-pet-loft-receipts`. Keep public access disabled. The Pages Functions binding must be named `RECEIPTS_BUCKET`.
5. Bind D1 as `DB` and R2 as `RECEIPTS_BUCKET` in both environments you intend to test/use. Configure preview and production separately as needed.

R2 is used only for files; no payment transfer runs through the application. Staff record payments already made to the shop. Customers contact the shop to use credit.

## 2. Google authentication

1. In a Google Cloud project enable the Google Sheets API and create a service account with a JSON key.
2. Share the selected spreadsheet with the JSON key's `client_email` as **Editor**. Public link access alone does not authenticate backend writes.
3. Set the following Cloudflare Pages server secrets/environment variables. Never put them in `VITE_*` variables, client source, GitHub commits or the spreadsheet:

| Variable | Value |
| --- | --- |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account `client_email` |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Complete PEM `private_key`; actual newlines or escaped `\n` are accepted |
| `AUTH_PEPPER` | A stable randomly generated secret, at least 32 characters |
| `INITIAL_BOSS_USERNAME` | First boss login, for example your own chosen username |
| `INITIAL_BOSS_PASSWORD` | A unique password, 12–256 characters |
| `GOOGLE_SHEET_ID` | Optional initial spreadsheet ID; the current tracker ID is in `.dev.vars.example` |

For local backend testing copy `.dev.vars.example` to `.dev.vars` and fill it locally. This file is ignored by Git. Do not use the placeholder values as actual secrets.

Passwords are stored as salted PBKDF2-SHA256 hashes with 600,000 iterations, after an HMAC using the server pepper. Browser sessions use HttpOnly cookies and hashed tokens in D1. Keep `AUTH_PEPPER` stable and protected; changing it requires resetting account passwords. After the first boss exists, the initial password does not overwrite its current password. Remove the bootstrap password secret after initial setup and keep a secure recovery record for the owner.

## 3. Build and connect

1. Connect the repository to Cloudflare Pages when you are ready to deploy. Use Node 24, build command `npm run build`, and output directory `dist`. Include the repository's `functions` directory; `public/_routes.json` routes `/api/*` to Functions.
2. Keep `VITE_DATA_MODE=cloud` for preview/production. `npm run dev:demo` is only a local demo preview.
3. Sign in through the Boss portal using the initial account. SQL-backed login/settings still work if Sheets is unavailable.
4. Open **Boss Settings → Backup & Data → Spreadsheet Database**, paste the existing tracker link and select **Check connection**. This check reads headers and records without writing them.
5. Review the counts and the preparation description, tick the existing-tabs acknowledgement, then select **Prepare & connect existing tabs**.

Preparation preserves tracker tabs and existing data/formatting, while adding these **hidden supporting columns**:

| Tab | Header row | Added columns |
| --- | --- | --- |
| Master Booking | 1 | AN:AR |
| Customer & Pet Directory | 6 | V:Z |
| Store Credit | 1 | T:X |

Each block holds `MPL_ID`, `MPL_DATA`, `MPL_LAST_OPERATION`, `MPL_DELETED`, and `MPL_SCHEMA`. Detailed multi-pet records and application fields without existing visible columns are stored in `MPL_DATA` in the same Sheet. Keep these columns intact, move them together with their rows when sorting, and do not copy their IDs when duplicating a record. The connection refuses to overwrite nonempty conflicting reserved headers.

Preparation also fixes the known Unpaid Balance query to filter **Balance Due > 0**, excluding cancelled bookings, and wraps compatible existing deposit/document-number array formulas to preserve their legacy calculation while allowing app-generated values. Existing credit usage/opening balances are reconciled into the ledger so they are counted once. The two existing credit records in the reviewed tracker did not require additional reconciliation entries. Explicitly editing an existing input field through the app may replace that cell's lookup formula; untouched lookup formulas and array-derived columns are preserved.

The legacy **Price List** and **Receipt** spreadsheet tabs remain available as historical/reference tools. They are not automatically rewritten with current SQL prices/format. Configure active application pricing and receipts in Boss Settings.

## Changing links and direct Sheet edits

The boss can check and activate another compatible spreadsheet link. Switching changes which records the app reads; it does **not** copy the previous Sheet's records into the destination, delete them, or create a new tracker. Prices, accounts and other SQL settings remain the same. Reconnect the old link to use its records again. A different tab/header layout needs an adapter change before it can be activated.

Authenticated clients refresh on focus and every 60 seconds while visible. The Refresh records button fetches immediately. App saves read current Sheet data again, validate it on the server, and write related booking/customer/credit cells in one atomic Google batch. Failed saves are shown as errors and are not replaced by local browser data. If Google accepts a save but its response is uncertain, retry the same action; the operation ID prevents duplicate payments. In some unresolved cases new changes wait four minutes for reconciliation.

The Sheet can be opened directly during an app outage, subject to Google's availability and its sharing permissions. Visible cell edits are read back into the app. Some details exist only in the hidden JSON columns; malformed dates, services, JSON or duplicated IDs can block reads until repaired. Do not edit hidden application metadata by hand.

**App staff credit restrictions apply only inside the app.** Anyone with direct spreadsheet Editor access can change financial cells regardless of their application role. For actual boss-only credit protection, restrict direct Sheet editors to authorised people or configure protected financial ranges. An “anyone with the link can edit” Sheet cannot enforce the app's staff/boss boundary.

Google Sheets cannot participate in the app's D1 lock. The app detects a changed snapshot before writing, but a direct human edit racing the final API write can still be overwritten. Avoid simultaneous direct financial edits while the shop records payments in the app. Google API quotas can also delay or block operations; the UI reports failures. Back up both Sheets and D1 separately using their provider tools.

## Verification completed and remaining live checks

The local production build and Pages Functions bundle compile. Automated tests exercise the actual local Cloudflare runtime with synthetic Google responses, temporary D1/R2, hashed login, secure sessions, permission denial, CSRF checks, private 1 MB files, atomic credit updates, duplicate retries after an ambiguous Google response, link switching and a Google outage. Adapter tests also cover legacy credit reconciliation, preservation of formulas and safe string writes.

A read-only sample from the existing tracker decoded 22 bookings, 16 customer records and two credit records; preparation calculations preserved the sampled balances and totals. This is not a complete workbook audit. No live Sheet preparation, formula evaluation, write, deployment or money transfer has been performed. Before production, test native Google formula recalculation and app create/edit/credit workflows against a copy of the tracker with real service-account credentials, then connect the chosen live Sheet.

Existing lint debt remains in frontend `any` types and React hook warnings; strict frontend/server TypeScript compilation passes. The current frontend bundle also has a size warning. These do not represent a successful lint check.

References: [Google service-account authentication](https://developers.google.com/identity/protocols/oauth2/service-account), [atomic Sheets batch requests](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/batchUpdate), [Sheets API limits](https://developers.google.com/workspace/sheets/api/limits), [Pages Functions routing](https://developers.cloudflare.com/pages/functions/routing/).
