import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePaymentConfig,
  providerAmount,
  createAqayeAdapter,
} from "../src/server/payment/aqaye.ts";
const env = {
  AQAYE_MODE: "sandbox",
  AQAYE_PIN: "sandbox",
  AQAYE_CALLBACK_URL: "https://shop.example/payment/callback",
};
test("provider configuration and integer currency fail closed", () => {
  assert.throws(() => parsePaymentConfig({}));
  assert.throws(() => parsePaymentConfig({ ...env, AQAYE_MODE: "live" }));
  assert.throws(() =>
    parsePaymentConfig({
      ...env,
      AQAYE_CALLBACK_URL: "http://shop.example/callback",
    }),
  );
  assert.equal(providerAmount(10000), 1000);
  assert.throws(() => providerAmount(10001));
  assert.throws(() => providerAmount(9990));
  assert.throws(() => providerAmount(4000000010));
});
test("mock provider creates and verifies using server amounts", async () => {
  const calls = [];
  const fake = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return new Response(
      JSON.stringify(
        url.endsWith("create")
          ? { status: "success", transid: "test-reference" }
          : { status: "success", code: "1" },
      ),
      { status: 200 },
    );
  };
  const adapter = createAqayeAdapter(parsePaymentConfig(env), fake);
  const created = await adapter.create({
    amountRials: 100000,
    invoiceId: "order-1",
  });
  assert.equal(created.amountTomans, 10000);
  assert.equal(calls[0].body.amount, 10000);
  assert.match(created.redirectUrl, /sandbox\/test-reference$/);
  assert.equal(
    await adapter.verify({ amountRials: 100000, transid: created.transid }),
    "verified",
  );
  assert.equal(calls[1].body.amount, 10000);
});
test("already verified, provider errors and malformed references never report fresh success", async () => {
  const config = parsePaymentConfig(env);
  const response =
    (body, status = 200) =>
    async () =>
      new Response(JSON.stringify(body), { status });
  assert.equal(
    await createAqayeAdapter(
      config,
      response({ status: "error", code: "2" }, 422),
    ).verify({ amountRials: 10000, transid: "abc" }),
    "already_verified",
  );
  assert.equal(
    await createAqayeAdapter(
      config,
      response({ status: "error", code: "-10" }, 422),
    ).verify({ amountRials: 10000, transid: "abc" }),
    "unconfirmed",
  );
  await assert.rejects(
    createAqayeAdapter(
      config,
      response({ status: "success", transid: "https://evil" }),
    ).create({ amountRials: 10000, invoiceId: "ok" }),
  );
});
