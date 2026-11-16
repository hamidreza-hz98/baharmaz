# Product administration

The independent administrator session is required for `/admin/products` and its API. Every mutation also checks `APP_ORIGIN`. The list supports search, availability and promotion filters, counts, pagination, quick price changes and archival. Product edits use a revision to reject stale changes. Product descriptions are plain text, not trusted HTML. Product SEO title and description are generated from product data; public product pages and metadata are planned separately.

## Data and pricing

Product prices are stored as safe integers in rials, in multiples of 10, and the administrator enters whole tomans (one toman is 10 rials). No fractional-toman rounding is performed. A discount is an optional absolute sale price, strictly greater than zero and lower than the regular price. Products require an active category; ingredients are optional. A gallery can contain up to ten distinct validated WebP media images and ingredients up to fifty distinct active entries. The server checks all references and limits regardless of the UI. Titles generate unique, immutable slugs; archived slugs remain reserved. Product archival preserves its record and excludes it from active lists.

## Setup and operations

Back up the database and run `npm run db:catalog:indexes` against the intended environment before product creation. It creates the product indexes as well as category and ingredient indexes; it is repeat-safe and fails for duplicates requiring manual review. It does not migrate or remove data. Product creation fails closed without the unique slug index.

Product writes and category/ingredient archival share a MongoDB lock to prevent a reference being added while its target is archived. Archival of a category or ingredient referenced by an active product is rejected. Concurrent operations can receive a conflict and should retry. The lock deliberately has no automatic expiry: if a process crashes while holding it, writes remain blocked. An operator must stop all product writers and catalog archival operations, inspect the `catalog_reference_locks` collection and database consistency, and explicitly remove a confirmed abandoned lock before restarting writers. Never remove a lock while a writer might still be active. Any future code that writes product references or archives catalog records must use this same lock; direct database writes can bypass the safeguards.

## Verification and dependencies

`npm run test:integration` uses an isolated MongoDB to check prices, references, slugs, authorization, revisions, archival and persistence. `npm run test:foundation` exercises product forms and quick pricing on desktop and mobile with mocked services. For optional real-browser integration, build first and set `CATALOG_BROWSER_EXECUTABLE` to a local Chrome/Chromium executable before the integration run. Admin login remains a separate task; integration uses a synthetic admin session. Media deletion remains disabled pending complete reference tracking.
