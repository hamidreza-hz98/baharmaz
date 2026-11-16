import test from "node:test";
import assert from "node:assert/strict";
import { createDevelopmentSmsProvider } from "../src/server/otp/provider.ts";
import { configuredSmsProvider } from "../src/server/otp/configured-provider.ts";
import { createAqayeAdapter } from "../src/server/payment/aqaye.ts";

test("development SMS cannot be enabled in production", () => {
  let delivered = false;
  assert.throws(() =>
    createDevelopmentSmsProvider({ NODE_ENV: "production" }, () => {
      delivered = true;
    }),
  );
  assert.throws(() =>
    configuredSmsProvider({
      NODE_ENV: "production",
      SMS_PROVIDER: "development",
      OTP_DEV_LOG_CODES: "true",
    }),
  );
  assert.equal(delivered, false);
});

test("live payment mode is rejected before any injected provider call", () => {
  let calls = 0;
  const fetcher = () => {
    calls++;
    throw new Error("network forbidden");
  };
  assert.throws(() =>
    createAqayeAdapter(
      {
        mode: "live",
        pin: "sandbox",
        callback: "https://example.test/callback",
      },
      fetcher,
    ),
  );
  assert.equal(calls, 0);
});
