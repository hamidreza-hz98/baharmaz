# Payment outcomes

Aqaye Pardakht sandbox checkout now persists separate test attempts and exposes authenticated result pages. Verified sandbox success, failure, and uncertain states are displayed explicitly as test outcomes. Successful test payments do not create fulfillment orders or real sales. See `aqaye-payment.md` for configuration, callback correlation, idempotency, and test instructions.

`src/modules/payment/outcome.ts` remains a pure transition contract for future non-sandbox payment work. A callback alone must not establish successful payment, and uncertain or already-verified responses require reconciliation. Live payment, real order creation, reconciliation, and fulfillment remain disabled.
