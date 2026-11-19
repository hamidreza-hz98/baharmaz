import assert from "node:assert/strict";
import mongoose from "mongoose";
import { getDatabaseConfig } from "../../src/server/config/database.ts";
import { Customer } from "../../src/server/identity/identity.ts";
import { Product } from "../../src/server/products/products.ts";
import { Address } from "../../src/server/address/address.ts";
import { Cart, customerId, changeCart } from "../../src/server/cart/cart.ts";
import { Order, getOrder } from "../../src/server/orders/orders.ts";
import {
  DeliveryQuote,
  deliveryOptions,
  createQuote,
  savePolicy,
} from "../../src/server/delivery/delivery.ts";
import {
  SandboxCheckout,
  submitSandboxOrder,
  finishSandboxPayment,
  getSandboxOrder,
  listSandboxOrders,
  reconcileSandboxOrder,
} from "../../src/server/payment/sandbox-orders.ts";

process.env.AQAYE_MODE = "sandbox";
process.env.AQAYE_PIN = "sandbox";
process.env.AQAYE_CALLBACK_URL =
  "https://shop.example/api/payments/aqaye/callback";
const config = getDatabaseConfig();
await mongoose.connect(config.uri, { dbName: config.dbName, autoIndex: false });
try {
  await DeliveryQuote.createIndexes();
  await savePolicy(
    {
      zones: [
        {
          id: "zone",
          name: "منطقه تست",
          feeRials: 50000,
          polygon: [
            { lat: 35, lng: 51 },
            { lat: 35, lng: 52 },
            { lat: 36, lng: 52 },
            { lat: 36, lng: 51 },
          ],
        },
      ],
      slots: [
        {
          id: "slot",
          label: "تحویل تست",
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          start: "00:00",
          end: "23:59",
          capacity: null,
        },
      ],
      closures: [],
      leadMinutes: 0,
      cutoffDaysBefore: 0,
      cutoffTime: "23:59",
      horizonDays: 3,
      quoteTtlSeconds: 600,
    },
    0,
  );
  const product = await Product.create({
    title: "کیک تست",
    searchTitle: "کیک تست",
    slug: "sandbox-test-cake",
    categoryId: new mongoose.Types.ObjectId().toString(),
    priceRials: 100000,
    discountPriceRials: null,
    available: true,
    gallery: [],
  });
  async function fixture(number) {
    const customer = await Customer.create({
      name: `کاربر تست ${number}`,
      firstName: "کاربر",
      lastName: `تست ${number}`,
      mobile: `0912000000${number}`,
      mobileVerified: true,
    });
    const id = String(customer._id);
    const address = await Address.create({
      customerId: id,
      label: "خانه",
      recipient: "کاربر تست",
      mobile: customer.mobile,
      address: "تهران نشانی آزمایشی",
      postalCode: "",
      coordinates: { lat: 35.7, lng: 51.4 },
      revision: 0,
    });
    await changeCart(customerId(id), "add", {
      productId: String(product._id),
      quantity: 1,
    });
    const days = (await deliveryOptions(id, String(address._id))).days;
    const day = days.find((d, i) => i > 0 && d.slots.some((s) => s.available));
    assert.ok(day);
    const quote = await createQuote(id, String(address._id), day.date, "slot");
    return { id, quote };
  }
  let created = 0,
    verified = 0,
    callback = "";
  const fake = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith("/create")) {
      created++;
      callback = body.callback;
      await new Promise((r) => setTimeout(r, 30));
      return Response.json({ status: "success", transid: "TESTTRANS1" });
    }
    verified++;
    assert.equal(body.amount, 15000);
    assert.equal(body.transid, "TESTTRANS1");
    return Response.json({ status: "success", code: "1" });
  };
  const first = await fixture(1);
  const [one, duplicate] = await Promise.all([
    submitSandboxOrder(first.id, first.quote.token, fake),
    submitSandboxOrder(first.id, first.quote.token, fake),
  ]);
  assert.equal(one.code, duplicate.code);
  assert.equal(created, 1);
  const persisted = await SandboxCheckout.findById(
    (await import("node:crypto"))
      .createHash("sha256")
      .update(first.quote.token)
      .digest("hex"),
  ).lean();
  assert.equal(persisted.state, "pending");
  assert.equal(persisted.snapshot.delivery.totalRials, 150000);
  const reference = callback.split("/").at(-1);
  assert.equal(await finishSandboxPayment(reference, "wrong", "1", fake), null);
  assert.equal(
    await getSandboxOrder(new mongoose.Types.ObjectId().toString(), one.code),
    null,
  );
  await Promise.all([
    finishSandboxPayment(reference, "TESTTRANS1", "1", fake),
    finishSandboxPayment(reference, "TESTTRANS1", "1", fake),
  ]);
  assert.equal((await getSandboxOrder(first.id, one.code)).state, "verified");
  const testOrder = await getOrder(first.id, one.code);
  assert.equal(testOrder.isTest, true);
  assert.equal(testOrder.payment.status, "sandbox_verified");
  assert.equal(testOrder.totals.paidRials, null);
  assert.equal(await Order.countDocuments({ code: one.code }), 1);
  assert.equal(verified, 1);
  assert.equal(
    (await Cart.findById(customerId(first.id)).lean()).lines.length,
    0,
  );
  await finishSandboxPayment(reference, "TESTTRANS1", "0", fake);
  assert.equal((await getSandboxOrder(first.id, one.code)).state, "verified");
  const history = await listSandboxOrders(first.id);
  assert.equal(history.length, 1);
  assert.equal(history[0].items[0].title, "کیک تست");
  assert.equal(history[0].items[0].quantity, 1);
  const second = await fixture(2);
  let secondCallback = "";
  const failureFake = async (url, options) => {
    assert.ok(url.endsWith("/create"));
    secondCallback = JSON.parse(options.body).callback;
    return Response.json({ status: "success", transid: "TESTTRANS2" });
  };
  const failed = await submitSandboxOrder(
    second.id,
    second.quote.token,
    failureFake,
  );
  await finishSandboxPayment(
    secondCallback.split("/").at(-1),
    "TESTTRANS2",
    "2",
    failureFake,
  );
  assert.equal((await getSandboxOrder(second.id, failed.code)).state, "failed");
  assert.equal(
    (await Cart.findById(customerId(second.id)).lean()).lines.length,
    1,
  );
  const third = await fixture(3);
  let thirdCallback = "";
  let verifyFails = true;
  const uncertainFake = async (url, options) => {
    if (url.endsWith("/create")) {
      thirdCallback = JSON.parse(options.body).callback;
      return Response.json({ status: "success", transid: "TESTTRANS3" });
    }
    if (verifyFails) throw new Error("Provider temporarily unavailable");
    return Response.json({ status: "error", code: "2" }, { status: 422 });
  };
  const uncertain = await submitSandboxOrder(
    third.id,
    third.quote.token,
    uncertainFake,
  );
  await finishSandboxPayment(
    thirdCallback.split("/").at(-1),
    "TESTTRANS3",
    "1",
    uncertainFake,
  );
  assert.equal(
    (await getSandboxOrder(third.id, uncertain.code)).state,
    "unknown",
  );
  assert.equal(
    (await Cart.findById(customerId(third.id)).lean()).lines.length,
    1,
  );
  assert.equal(
    await reconcileSandboxOrder(
      new mongoose.Types.ObjectId().toString(),
      uncertain.code,
      uncertainFake,
    ),
    null,
  );
  verifyFails = false;
  assert.equal(
    (await reconcileSandboxOrder(third.id, uncertain.code, uncertainFake))
      .state,
    "verified",
  );
  assert.equal(
    (await Cart.findById(customerId(third.id)).lean()).lines.length,
    0,
  );
  const fourth = await fixture(6);
  let fourthCallback = "";
  const changedCartFake = async (url, options) => {
    if (url.endsWith("/create")) {
      fourthCallback = JSON.parse(options.body).callback;
      return Response.json({ status: "success", transid: "TESTTRANS4" });
    }
    return Response.json({ status: "success", code: "1" });
  };
  const changedCart = await submitSandboxOrder(
    fourth.id,
    fourth.quote.token,
    changedCartFake,
  );
  await changeCart(customerId(fourth.id), "add", {
    productId: String(product._id),
    quantity: 1,
  });
  await finishSandboxPayment(
    fourthCallback.split("/").at(-1),
    "TESTTRANS4",
    "1",
    changedCartFake,
  );
  assert.equal(
    (await getSandboxOrder(fourth.id, changedCart.code)).state,
    "verified",
  );
  assert.equal(
    (await Cart.findById(customerId(fourth.id)).lean()).lines[0].quantity,
    2,
  );
  if (process.env.SANDBOX_REAL_SMOKE === "1") {
    for (const [number, choice, expected] of [
      [4, "1", "verified"],
      [5, "2", "failed"],
    ]) {
      const sample = await fixture(number);
      let callbackUrl = "";
      const realTransport = async (url, options) => {
        if (url.endsWith("/create"))
          callbackUrl = JSON.parse(options.body).callback;
        return fetch(url, options);
      };
      const created = await submitSandboxOrder(
        sample.id,
        sample.quote.token,
        realTransport,
      );
      assert.equal(created.state, "pending");
      const transaction = created.redirectUrl.split("/").at(-1);
      const paymentPage = await fetch(created.redirectUrl, {
        signal: AbortSignal.timeout(15000),
      });
      assert.equal(paymentPage.status, 200);
      const pageText = await paymentPage.text();
      assert.match(pageText, /تست سندباکس/);
      const providerCallback = await fetch(
        "https://panel.aqayepardakht.ir/callback/sandbox",
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ transid: transaction, status: choice }),
          signal: AbortSignal.timeout(15000),
        },
      );
      assert.equal(providerCallback.status, 200);
      const html = await providerCallback.text();
      assert.ok(html.includes(callbackUrl));
      const returnedStatus = html.match(
        /name=["']status["'][^>]*value=["']([^"']+)["']/,
      )?.[1];
      assert.ok(returnedStatus);
      await finishSandboxPayment(
        callbackUrl.split("/").at(-1),
        transaction,
        returnedStatus,
        realTransport,
      );
      assert.equal(
        (await getSandboxOrder(sample.id, created.code)).state,
        expected,
      );
      assert.equal(
        (await Cart.findById(customerId(sample.id)).lean()).lines.length,
        expected === "verified" ? 0 : 1,
      );
    }
    console.log(
      "Aqaye Pardakht sandbox success and failure verified with synthetic data.",
    );
  }
  console.log(
    "Sandbox order checks passed: idempotency, owner isolation, verification, replay, failure, and uncertain outcomes.",
  );
} finally {
  await mongoose.disconnect();
}
