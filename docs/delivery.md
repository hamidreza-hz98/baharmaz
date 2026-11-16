# Delivery selection and quotes

Delivery is **disabled until the shop supplies and authorizes its actual rules**. There is no default delivery zone, fee, timetable, closure, lead time, cutoff or quote lifetime. With no active policy the customer sees an unavailable message and no fee is calculated. The policy is not seeded with example values. The authenticated `/checkout/address` page uses customer-owned addresses and presents Jalali dates and eligible slots. Missing coordinates, out-of-area and overlapping zones, no slots, provider failures and expired quotes are shown explicitly. Address CRUD remains at `/account/addresses`.

## Policy contract and deployment

Back up the intended database, then run `npm run db:delivery:indexes` to create the unique quote-token and quote-expiry indexes. Quote creation fails closed until these indexes exist. An authenticated admin may edit the complete policy JSON at `/admin/operational-settings`, or read `GET /api/admin/delivery` and submit `PUT /api/admin/delivery` with the current `revision` and a complete `policy` object; requests require matching `APP_ORIGIN`. Setting `policy` to null disables delivery. Stale revisions are rejected. The editor starts empty when no policy exists, retains unsaved text after errors and requires confirmation before disabling or replacing a conflicted draft. An operator must supply the complete approved configuration; the interface intentionally does not seed a fee or zone.

A policy must explicitly specify:

- `zones`: unique IDs, names, fees in integer rials divisible by ten, and simple polygons of WGS84 `{lat,lng}` vertices. Fee zero is allowed only when deliberately configured. Boundaries count as inside; overlapping zones fail closed instead of choosing an arbitrary fee. The planar polygon method is intended for local delivery areas, not antimeridian-spanning or global regions. Addresses without coordinates cannot be quoted.
- `slots`: unique IDs and labels, ISO weekdays (Monday 1 through Sunday 7), start/end `HH:mm` in Tehran time and `capacity`. Slots do not cross midnight. `capacity: null` explicitly means unlimited; any finite capacity currently makes that slot unavailable because order-backed capacity and atomic reservations are not implemented. Do not use unlimited capacity unless the shop approves it.
- `closures`: Gregorian civil dates in `YYYY-MM-DD`; `leadMinutes`, `cutoffDaysBefore`, `cutoffTime` (`HH:mm` Tehran), `horizonDays` and `quoteTtlSeconds` must all be provided. A slot is available only before its cutoff and with the required lead time. Dates displayed to customers use the Jalali calendar; cutoff and lead-time calculations use Tehran civil time and actual instants.

The application assumes a single fixed fee per polygon and a global cutoff and lead time. Other zone shapes, per-slot fees, holidays, minimums, capacity rules, out-of-area exceptions and other policies require an explicit decision and implementation before enabling them. Provider coverage and live capacity are not inferred from a map.

## Quote safety and remaining work

`POST /api/delivery` supports `options`, `quote` and `validate` for the signed-in customer; all mutations require the configured origin and are no-store. A quote records the customer, address revision, delivery policy revision, selected slot, current cart revision and current product prices, with a short-lived opaque token. Validation rejects expired quotes and changes to cart, product prices or availability, address, policy, coverage or slot eligibility. The server computes the fee and total in integer rials; client-submitted prices are ignored. Expiry is checked explicitly rather than relying on MongoDB TTL cleanup.

The current quote is shown on the delivery page, but it is not yet carried into the cart summary or an order. The order-creation flow does not exist: task 22 must atomically revalidate the quote, ownership and capacity while creating the order, and task 21 remains open until approved rules and any required capacity implementation are verified. Do not treat a browser-stored address ID or a displayed quote as an order or a reservation.

Unit tests use synthetic polygons and dates; integration tests use isolated MongoDB and synthetic policies to test authorization, coverage, totals and stale/expired quote rejection. Browser tests use mocked responses. These test rules are not shop configuration and do not authorize a real delivery fee.
