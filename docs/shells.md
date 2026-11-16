# Shared shells and page states

The storefront shell uses the local HTML homepage as a starting point and links to the implemented storefront, cart and account routes. Its mobile drawer supports keyboard dismissal and focus return. Loading, not-found and recoverable route errors use generic Persian messages and do not expose exception details; a separate root fallback covers errors in the root layout.

`AdminShell` is a presentation component mounted beneath server-side admin guards on the existing management routes; presentation alone does not authorize access. Never pass sensitive data to it before the guard. Its navigation links and profile menu connect to current admin routes.

The shared page-state primitives include loading, empty, no-results, permission and retryable error states. Callers must enforce authorization on the server; a permission view is only presentation. Do not use an error view as a replacement for HTTP status and server-side access checks. The root loading boundary can cause missing catalog records to stream HTTP 200 before the not-found view; see `public-catalog.md`. Design and accessibility work remains in `accessibility-performance-qa.md`.
