# Admin authentication

Run the separate `npm run admin:bootstrap` procedure described in the identity documentation before signing in at `/admin/login`. No password or administrator is created by the web login. Configure `APP_ORIGIN`, MongoDB and `SESSION_DAYS` as documented in the environment template. Run `npm run db:identity:indexes` after backing up the database; it creates the TTL index used for rate buckets as well as identity indexes.

Login uses the independent singleton admin and the existing scrypt password verifier and opaque, revocable, HTTP-only admin cookie. Customer cookies do not grant admin access. The account menu links to personal information and active sessions, and logout revokes only the current admin session. Changing or revoking a session is subject to the existing account guards.

Login attempts are limited globally to ten per fixed minute across instances using an atomic MongoDB counter. This avoids trusting client-controlled IP headers, but a malicious client can temporarily deny login for all administrators and a minute boundary permits a short burst. Deployments should additionally enforce trusted edge rate limits and monitor failed attempts. The database is required for login and limiting; failures deny access. Keep `APP_ORIGIN` exact and serve production through HTTPS.
