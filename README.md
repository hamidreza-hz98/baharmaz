# Baharmaz Online Shop

A Persian RTL storefront and administration application. The homepage and information pages use database-backed content; remaining storefront and administration work is tracked in the implementation checklist.

## Toolchain

Use Node.js 24 LTS (>=24.15 and <25) and npm 11 (>=11.12.1 and <12). Next.js 16 is Active LTS according to the [Next.js support policy](https://nextjs.org/support-policy); Node 24 is an LTS line according to [Node.js releases](https://nodejs.org/en/about/previous-releases). Checked 2026-11-09. Node 24 is chosen to match the available environment and the two reference projects. Dependencies are locked in `package-lock.json`; use `npm ci` for reproducible installs.

## Local development

1. Install the toolchain above and run `npm ci`.
2. Start the local MongoDB instance and configure `.env.local` as described below, then run `npm run dev` and open http://localhost:3000.
3. Run `npm run lint`, `npm run typecheck`, `npm run format:check`, and `npm run build` to validate.

`.env.example` documents configuration names without secrets. See [MongoDB setup and operations](docs/database.md) for local setup, configuration and health checks. Never place credentials in source control.

## Reference review

Armani Caffe separates app routing, domain modules, server, storefront, dashboard and theme; Sara Kitchen likewise separates app, server, components and theme. Both use Next.js, TypeScript, MUI and Mongoose with explicit quality scripts. Their separation and quality checks inform subsequent tasks; no code, assets, secrets or extra services were copied. This project will use npm, like Armani, and keep infrastructure scoped to its own requirements.

ESLint 10 is supported by the ESLint project. Next.js 16.3.6 includes React, import, and accessibility plugins whose peer ranges do not yet declare ESLint 10, so npm reports peer override warnings. The ESLint compatibility adapter handles their older rule API; reassess this workaround when Next.js updates those plugins.

See [architecture and API contracts](docs/architecture.md) for module boundaries and verification commands.

See [testing and CI](docs/testing.md) for isolated integration, browser and quality commands.

See [locale and money policies](docs/locale-and-money.md) for date, currency and input conventions.

See [media storage and operations](docs/media.md) for supported formats, limits, access and orphan-audit policy.

See [categories and ingredients](docs/catalog-foundation.md) for indexes, ordering and archival policy.

See [content settings](docs/content-settings.md) for the public/admin contracts, update validation and cache behavior.

See [information pages and contact operations](docs/information-pages.md) for setup, rate limits and message retention.

See [addresses and map providers](docs/addresses.md) for private address storage, indexes and optional provider setup.

See [cart and pricing](docs/cart.md) for guest persistence, merge behavior and the pending shipping quote.

See [delivery policies and quotes](docs/delivery.md) for required business decisions, configuration and current limitations.

See [deployment preparation and operations](docs/deployment-operations.md) for production prerequisites, isolated recovery checks and outstanding provider and hosting decisions.
