# MongoDB setup and operations

The application uses database `lamsechi` on the deployment specified by `MONGODB_URI`; the explicit database option takes precedence over any URI path. Use a dedicated deployment and least-privilege credentials for each environment. Never point development at production. MongoDB stores future media as well as application records; no object store is configured.

## Local setup

Install Docker with Compose, copy `.env.example` to `.env.local`, then run `docker compose -f infra/compose.yaml up -d --wait`. The development instance listens only on `127.0.0.1:27018` and persists in a named volume. Run `npm run db:config:check`, then `npm run dev`. Stop and restart with `docker compose -f infra/compose.yaml stop` and `docker compose -f infra/compose.yaml up -d --wait`. These commands do not delete the volume. The unauthenticated compose service is for a trusted local machine only; do not expose it or use it in production. A standalone server does not support transactions; use a replica set for future transactional tasks.

`MONGODB_URI` is required when database access is attempted. `npm run db:config:check` validates it without making a network connection or printing its value. Pool size defaults to 10 (range 1–100) per Node process and server selection timeout to 5000 ms (range 100–30000). Set budgets for the number of application processes and MongoDB topology; monitoring sockets are additional. Connection attempts are shared in a process and retried after failure; the driver manages subsequent reconnects. Automatic collection and index creation and Mongoose command buffering are disabled.

## Health

`GET /api/health/live` checks that the process responds; it does not check dependencies. `GET /api/health/ready` pings MongoDB and returns 200 or a generic 503, with no configuration or exception details. Neither endpoint authenticates or exposes database data. Configure infrastructure to poll readiness at a reasonable interval; monitor failed checks separately. Use the configuration check locally to diagnose missing settings; database failures can have multiple causes and are deliberately not returned to clients.

## Tests and safety

When `NODE_ENV=test`, configuration requires `MONGODB_TEST_URI` pointing to an unauthenticated loopback instance with an explicit port and `MONGODB_TEST_DB_NAME` matching `lamsechi_test_*`. Use a separate test server and unique database name per run; these checks are guardrails, not a substitute for isolation. Never reuse a production URI. No database drop, migration, seed, or destructive command is supplied by this task. Integration tests must create their own temporary server and avoid production services.

## Indexes and migrations

Domain indexes are declared by their models and created through the documented `db:*:indexes` scripts. Run each required index operation as a separately authorized deployment operation, after a backup and a review of existing data, duplicates and load. Do not use `syncIndexes()` as a startup shortcut: it can remove indexes. Startup and readiness do not create indexes. There is no general versioned data-migration runner: future schema/data migrations need an explicit tested upgrade, migration ledger and rollback or forward-repair plan before deployment.

`npm run test:backup-restore` starts a temporary loopback-only standalone MongoDB, writes a synthetic document and GridFS file, runs the identity, cart, delivery, address, catalog, contact and order index scripts twice, cleanly stops the test server, copies its data directory, and starts a second isolated instance from the copy to verify the document, GridFS bytes and an index. Set `MONGOD_BINARY` and an isolated `TEMP`/`TMP` with sufficient space. It never accepts a target URI and retains its own temporary data if it fails. This verifies a cold standalone copy in a synthetic environment, not online production backups, replica-set consistency, recovery objectives or a managed-provider restore.

Run `npm run test:database` with `mongod` available on PATH, or set `MONGOD_BINARY` to its executable path. It starts a dedicated temporary loopback server and a development app on ephemeral ports, checks readiness and restart persistence, and removes its own temporary directory after success. On failure it retains that directory and prints its path for diagnosis. Do not run this test concurrently with another Next.js build or dev server in this workspace.
