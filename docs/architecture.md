# Architecture and contracts

## Decisions

- The app is one Next.js App Router deployment, not a collection of services. `src/app` contains routing, transport, metadata and composition. Route handlers translate results to HTTP; they do not contain domain rules.
- `src/modules/<domain>` contains domain types, use cases and ports. It must not import Next.js, presentation or infrastructure. `src/server` contains server-only composition and infrastructure adapters; adapters implement domain ports. `src/storefront` and `src/admin` contain presentation. `src/shared` holds environment-neutral contracts and utilities. `src/theme` owns shared presentation tokens and providers when the approved design is available.
- Dependencies point inward: app -> presentation and server composition -> domain; server adapters implement domain ports. Domain and shared code cannot depend on app, server, presentation or theme. Avoid cross-domain internals; introduce explicit public contracts as needed.
- Every runtime file in `src/server` must begin with `import "server-only"`. Next.js rejects a client module importing such a file, including transitively. ESLint also prohibits forbidden imports in domain/shared code. These guards complement review, not authorization: all future protected reads and mutations still require server-side guards.
- The shop introduction is an intentionally small example: a domain use case consumes a reader port; a server adapter supplies temporary public text; the app composes it into a storefront view and a read-only API. It is not a database-backed settings implementation. Admin UI is not exposed before authorization exists.

## API conventions

JSON success is `{ ok: true, data }`; errors are `{ ok: false, error: { code, message } }`. Codes are stable machine-readable identifiers, messages are safe Persian text. Use 400 for invalid input, 401 for missing authentication, 403 for forbidden access, 404 for absent resources, 409 for conflicts and 500 for unexpected errors. Validate at the server boundary, authorize before accessing protected data, and never expose exception text, credentials, stack traces or sensitive identifiers. Do not assume a result type itself enforces authorization. The example endpoint only implements its public read and generic 500 case; introduce typed helpers as real endpoints need them.

Run `npm run test:boundaries` to check that Next rejects a deliberately client-imported server module. The test creates a temporary route exclusively for the duration of the test and removes it in a finally block; do not run it concurrently with other builds or development servers. A normal build after the test verifies the real app. Do not put secrets in test fixtures.
