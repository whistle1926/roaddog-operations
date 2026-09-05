# RoadDog Operations

Courier operations system for RoadDog Courier Service, Wexford. Built from the Claude Design
prototype `RoadDog Operations.dc.html` (kept for reference in `design-src/`).

Three roles share one data model, so an action in one place shows up everywhere else:

- **Owner / office admin** — dispatch board with drag-to-assign, live van map, jobs table with search
  and filters, customers and rate card, fleet compliance, payroll, invoicing, reports, POD archive,
  alerts and automation, settings.
- **Customer portal** — priced bookings (with PO enforcement), live tracking, history, invoices with
  bank-transfer payment notification, POD downloads, address book, users, support queries.
- **Driver app** — shift clock, current drop with navigation and call links, photo + signature POD
  capture, failed-delivery reasons, fuel receipts straight into payroll.

## Run it

```bash
npm start
```

Then open <http://127.0.0.1:4173>. No dependencies, no build step. Node 20+.

```bash
npm test
```

Runs the unit tests for the pricing engine and the state store (`node --test`).

## Deploy

Live at <https://roaddog.aiworldexperts.com> (Cloudflare Worker, static assets, custom domain).

```bash
npm run deploy
```

Copies the site files into `dist/` and runs `wrangler deploy` using `wrangler.jsonc`. Requires a
`wrangler login` on the Cloudflare account that owns the `aiworldexperts.com` zone.

## How it is put together

| File | Role |
| --- | --- |
| `src/pricing.js` | Pure pricing engine: zone/distance rate card, vehicle selection, surcharges, discounts, VAT. |
| `src/data/seed.js` | Demo dataset generated relative to "now", so it looks live on any day. |
| `src/store.js` | State container: persistence (localStorage), actions, derived selectors (KPIs, alerts, payroll, billing). |
| `src/ui/render.js` | Render engine: full re-render from state, focus/scroll preservation, delegated events, drag & drop, toasts. |
| `src/ui/owner.js` | Owner screens. |
| `src/ui/drawers.js` | Job drawer, detail drawers, modals. |
| `src/ui/portal.js` | Customer portal. |
| `src/ui/driver.js` | Driver app. |
| `src/actions.js` | Wires `data-act` names to store actions; printing, image capture, signature pad. |
| `server.js` | Tiny static file server for local use. |

Views are template strings. All user data is HTML-escaped through `esc()`. UI events are declared
with `data-act` / `data-arg` attributes and dispatched from one delegated listener. Form inputs use
`data-bind="draft.key"` and write into non-persisted drafts; a submit validates and commits.

## Things worth knowing

- **Persistence** is browser localStorage. Settings → Users & roles → *Reset demo data* reseeds.
- **"Show financials"** toggle (Settings → Users & roles) masks prices, pay and balances, matching
  the design's `showFinancials` prop.
- **Printing**: invoice, POD and statement "PDF" buttons open a print-ready page; use the browser's
  Save as PDF.
- **Map** is a schematic SVG projection of van GPS positions. Swap in Google Maps / Mapbox for a
  road map.
- **Integrations** (Xero, Twilio, AIB feed, Maps) are represented as toggles and a sent-message log;
  no external calls are made.

## Next steps for production

1. Replace the localStorage adapter in `src/store.js` with an API (the actions are the contract).
2. Real auth: the role switcher stands in for login.
3. Map provider and SMS/email providers behind the existing automation toggles.
4. Offline queue for the driver app (events are already discrete, timestamped actions).
