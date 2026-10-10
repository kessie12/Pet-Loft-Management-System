# Mellow Pet Loft

Pet boarding, grooming, daycare, pet sitting and taxi management with a Google Sheets / Cloudflare D1 database split.

| Data | Authoritative storage |
| --- | --- |
| Master bookings and recorded payments | Google Sheets: Master Booking |
| Customers and pets | Google Sheets: Customer & Pet Directory |
| Store credit transactions | Google Sheets: Store Credit |
| Unpaid balance | Calculated from Master Booking; shown in Unpaid Balance |
| Service prices, receipt format, room types, kennels, assignment rules and other settings | Cloudflare D1 |
| Staff/boss accounts, salted password hashes, sessions and permissions | Cloudflare D1 |
| Receipt attachments, up to 1 MB each | Private Cloudflare R2 |

Cloud mode is the default. Requests go through Cloudflare Pages Functions; the browser never receives Google credentials or password hashes. Customer records have no SQL or local-storage fallback. SQL stores operation IDs, request digests and save locks to coordinate Sheets writes, without storing business-record payloads.

## Development

Use Node 24 (Node 22 or later is required).

```sh
npm ci
npm run dev:demo
```

Demo mode is a browser-only UI preview with its own local data. It cannot connect to the live Sheet and is not the production database. Demo credentials are `admin / admin` and `staff / 1234`; they do not authenticate cloud accounts.

For the actual local backend, configure the bindings and secrets described in [the setup guide](docs/hybrid-database.md), then run:

```sh
npm run db:migrate:local
npm run dev:cloud
```

`npm run dev` alone starts the frontend and does not provide `/api` routes. Cloud mode requires Pages Functions.

## Verification

```sh
npm test
npm run build
npm run build:functions
```

The runtime tests use synthetic Sheets responses and temporary D1/R2 storage. They never modify the shop spreadsheet. `npm run lint` remains available; existing frontend type/lint debt is described in the integration report.

## Live setup

Follow [the hybrid database setup guide](docs/hybrid-database.md). Hosting on GitHub/Cloudflare does not configure credentials or grant spreadsheet access automatically. Pricing and quotas depend on the providers and account plan; this project does not promise free operation indefinitely.
