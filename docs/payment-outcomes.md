# Payment outcome groundwork

`src/modules/payment/outcome.ts` contains a pure transition contract: callbacks alone cannot establish success; an unconfirmed or already-verified provider response does not establish fresh success; verified state is not downgraded by replayed evidence. `src/storefront/payment/payment-outcome.tsx` provides Persian verified, failure and pending presentation with an optional validated support telephone and optional internal actions. It must only receive state from an authenticated, server-owned record. It is not exposed by a production route.

This is not a payment lifecycle implementation. There is no persisted payment attempt or order, callback endpoint, reconciliation worker, owner-authorized result endpoint, fulfillment transition or retry action. Consequently duplicate callbacks, browser abandonment, verification failures, reconciliation, ownership and double-fulfillment cannot yet be integration-tested. Do not derive success from callback parameters or URL values. Complete tasks 22 and 23 and implement atomic persistent transitions and authorization before exposing these views. Task 24 remains open.

Run `node --test tests/payment-outcome.test.mjs` for the isolated transition tests; these tests do not prove database idempotency or provider behavior.
