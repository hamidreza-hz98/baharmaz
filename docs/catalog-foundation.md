# Categories and ingredients

`/admin/categories` and `/admin/ingredients` require the independent admin session. The API requires an admin session on every read and mutation; mutations additionally require a matching `APP_ORIGIN`. Search and pagination are server-side, with Persian UI and image-only selection through the shared private media picker. Category banner and icon are optional; an ingredient requires an image icon. Selected files must already exist as validated WebP media in MongoDB. Media deletion remains disabled until reference tracking is implemented.

## Setup and migration

Before creating or editing catalog data, back up the database and run `npm run db:catalog:indexes` with the correct environment. The command creates unique indexes for category and product slugs and normalized ingredient names; it is repeat-safe and does not delete indexes or data. Duplicate existing data causes it to fail and must be reviewed and repaired manually. Create operations fail closed if their required unique index is missing. These are new collections, so existing customer/media documents need no migration. Index creation requires suitable MongoDB privileges and is not performed automatically on application startup.

## Names, SEO and references

Category slugs are generated on creation with Persian/Arabic normalization. A numeric suffix is added when a slug already exists, including concurrent creation; slugs remain immutable when the name changes, avoiding broken links. Slugs of archived categories remain reserved. Category SEO title and description are derived from the current name and excerpt; there are no admin SEO fields. These values are data contracts only until public category pages and metadata are implemented in task 15. Do not publish raw HTML or trust the fields as sanitized markup.

Ingredient names are normalized and must be unique; names of archived ingredients remain reserved. Category and ingredient “delete” is implemented as archival (a `deletedAt` tombstone), not a physical delete, so historical references do not dangle. Archived entries are excluded from active lists and the homepage order. No restore or permanent-delete interface is supplied yet. Future product and order services must reject new references to archived entities, retain historical references and define how archived entities display. Physical deletion or media deletion must not be added until all references, including historical snapshots, are reviewed. Archival is rejected while an active product references the category or ingredient. Product reference writes and catalog archival share a lock; recovery and future-writer requirements are documented in `docs/products.md`.

## Homepage ordering

Categories appear in one homepage order; new active categories are appended automatically. The admin dialog provides drag-and-drop and keyboard-accessible up/down buttons. Moves are saved immediately to a single versioned MongoDB document; competing edits are rejected with a conflict message and can be refreshed. Archived/missing entries are filtered and newly created entries append even if a concurrent category change occurs. Reordering is limited to 5,000 active categories to keep the single order document and admin view bounded; listing has separate pagination. If this shop approaches that scale, replace the ordering strategy deliberately rather than silently truncating it.

## Verification and remaining dependencies

`npm run test:integration` covers generated slugs and collisions, unique-name indexes, image reference validation, concurrent reorder conflicts, order persistence across database restart, archival and protected API permissions using isolated MongoDB. `npm run test:foundation` covers drag/drop, keyboard movement, conflict refresh, media selection and category/ingredient editing at desktop and mobile with mocked requests. Admin login remains task 26; tests use isolated admin sessions. Public catalog and homepage rendering are later tasks. Existing media task 11 still has an open video-bitstream validation limitation; category/ingredient selectors accept only images.

For an additional real-browser integration run, first run `npm run build`. Set `CATALOG_BROWSER_EXECUTABLE` to a local Chrome/Chromium executable and run `npm run test:integration` with `mongod` available. The optional check starts the production build against the suite's temporary database, uses a synthetic admin session, and exercises both viewport sizes; it sends no live messages or production data.
