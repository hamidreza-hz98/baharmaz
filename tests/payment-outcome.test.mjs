import { test } from "node:test";
import assert from "node:assert/strict";
import { paymentTransition } from "../src/modules/payment/outcome.ts";
test("callbacks cannot mark payment verified and replay preserves verified", () => {
  assert.equal(paymentTransition("pending", { type: "callback" }), "pending");
  assert.equal(paymentTransition("verified", { type: "callback" }), "verified");
  assert.equal(
    paymentTransition("verified", { type: "confirmed_failure" }),
    "verified",
  );
});
test("only explicit verification establishes success; uncertain results stay pending", () => {
  assert.equal(
    paymentTransition("pending", { type: "verification", result: "verified" }),
    "verified",
  );
  assert.equal(
    paymentTransition("pending", {
      type: "verification",
      result: "unconfirmed",
    }),
    "pending",
  );
  assert.equal(
    paymentTransition("pending", {
      type: "verification",
      result: "already_verified",
    }),
    "pending",
  );
  assert.equal(
    paymentTransition("pending", { type: "confirmed_failure" }),
    "failed",
  );
});
