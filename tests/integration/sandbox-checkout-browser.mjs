import assert from "node:assert/strict";
import { createHash, randomBytes, randomInt } from "node:crypto";
import mongoose from "mongoose";
import { chromium } from "playwright";
import { getDatabaseConfig } from "../../src/server/config/database.ts";
import {
  Customer,
  Session,
  createSession,
} from "../../src/server/identity/identity.ts";
import { Product } from "../../src/server/products/products.ts";
import { Address } from "../../src/server/address/address.ts";
import { Cart, customerId, changeCart } from "../../src/server/cart/cart.ts";
import {
  DeliveryQuote,
  deliveryOptions,
  createQuote,
} from "../../src/server/delivery/delivery.ts";
import { SandboxCheckout } from "../../src/server/payment/sandbox-orders.ts";

if (process.env.SANDBOX_BROWSER_SMOKE !== "1")
  throw new Error("Explicit sandbox smoke opt-in is required.");
const config = getDatabaseConfig();
if (
  !/^mongodb:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\/?(?:\?.*)?$/i.test(
    config.uri,
  )
)
  throw new Error("Smoke test requires a local, unauthenticated MongoDB.");
if (
  process.env.APP_ORIGIN !== "http://localhost:3000" ||
  process.env.AQAYE_MODE !== "sandbox" ||
  process.env.AQAYE_PIN !== "sandbox"
)
  throw new Error("Smoke test requires the local sandbox configuration.");
await mongoose.connect(config.uri, { dbName: config.dbName, autoIndex: false });
const created = [];
let browser;
let adminSessionHash;
try {
  const adminSession = await createSession("admin", "primary");
  adminSessionHash = createHash("sha256")
    .update(adminSession.token)
    .digest("hex");
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  for (const [choice, expected] of [
    ["پرداخت موفق", "verified"],
    ["پرداخت ناموفق", "failed"],
  ]) {
    const marker = `SANDBOX_SMOKE_${randomBytes(8).toString("hex")}`;
    const row = { marker };
    created.push(row);
    const customer = await Customer.create({
      name: marker,
      firstName: "تست",
      lastName: "پرداخت",
      mobile: `09${randomInt(100000000, 999999999)}`,
      mobileVerified: true,
    });
    row.customer = String(customer._id);
    const session = await createSession("customer", row.customer);
    row.sessionHash = createHash("sha256").update(session.token).digest("hex");
    const product = await Product.create({
      title: marker,
      searchTitle: marker,
      slug: marker.toLowerCase(),
      categoryId: new mongoose.Types.ObjectId().toString(),
      priceRials: 1000000,
      discountPriceRials: null,
      available: true,
      gallery: [],
    });
    row.product = product._id;
    const address = await Address.create({
      customerId: row.customer,
      label: "تست",
      recipient: "گیرنده آزمایشی",
      mobile: customer.mobile,
      address: "نشانی ساختگی آزمایش",
      postalCode: "",
      coordinates: { lat: 35.69972, lng: 51.33722 },
      revision: 0,
    });
    row.address = address._id;
    await changeCart(customerId(row.customer), "add", {
      productId: String(product._id),
      quantity: 1,
    });
    const options = await deliveryOptions(row.customer, String(address._id));
    const day = options.days.find((d) => d.slots.some((s) => s.available));
    assert.ok(day, "No test delivery time is available");
    const slot = day.slots.find((s) => s.available);
    const quote = await createQuote(
      row.customer,
      String(address._id),
      day.date,
      slot.id,
    );
    row.quoteHash = createHash("sha256").update(quote.token).digest("hex");
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    await context.addCookies([
      {
        name: "lamsechi_customer_session",
        value: session.token,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await context.addInitScript((token) => {
      if (location.pathname === "/checkout/review")
        sessionStorage.setItem("lamsechi-delivery-quote", token);
    }, quote.token);
    const page = await context.newPage();
    await page.goto("http://localhost:3000/checkout/review", {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("button", { name: "ثبت سفارش و پرداخت آزمایشی" })
      .click();
    await page.waitForURL(
      /https:\/\/panel\.aqayepardakht\.ir\/startpay\/sandbox\//,
      { timeout: 30000 },
    );
    await page.getByText(choice, { exact: true }).first().click();
    await page.waitForURL(/http:\/\/localhost:3000\/checkout\/payment\/TEST-/, {
      timeout: 30000,
    });
    const expectedTitle =
      expected === "verified"
        ? "پرداخت آزمایشی موفق بود"
        : "پرداخت آزمایشی ناموفق بود";
    await page
      .getByRole("heading", { name: expectedTitle })
      .waitFor({ timeout: 20000 });
    const order = await SandboxCheckout.findById(row.quoteHash).lean();
    assert.equal(order.state, expected);
    const forbidden = await page.request.get(
      "http://localhost:3000/api/admin/sandbox-orders",
    );
    assert.equal(forbidden.status(), 401);
    const account = await page.request.get(
      `http://localhost:3000/api/checkout/sandbox-orders/${order.code}`,
    );
    assert.equal(account.status(), 200);
    assert.equal((await account.json()).order.state, expected);
    const adminContext = await browser.newContext();
    await adminContext.addCookies([
      {
        name: "lamsechi_admin_session",
        value: adminSession.token,
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    const adminPage = await adminContext.newPage();
    await adminPage.goto("http://localhost:3000/admin/orders", {
      waitUntil: "domcontentloaded",
    });
    await adminPage
      .getByRole("heading", { name: "سفارش‌های آزمایشی" })
      .waitFor();
    await adminPage.getByText(order.code, { exact: true }).click();
    await adminPage.getByText(marker, { exact: false }).first().waitFor();
    await adminContext.close();
    const cart = await Cart.findById(customerId(row.customer)).lean();
    assert.equal(cart.lines.length, expected === "verified" ? 0 : 1);
    console.log(`Browser sandbox ${expected} flow passed`);
    await context.close();
  }
} finally {
  if (browser) await browser.close();
  if (adminSessionHash)
    await Session.deleteOne({
      tokenHash: adminSessionHash,
      principalId: "primary",
    });
  for (const row of created) {
    if (row.quoteHash) {
      await SandboxCheckout.deleteOne({
        _id: row.quoteHash,
        customerId: row.customer,
      });
      await DeliveryQuote.deleteOne({
        tokenHash: row.quoteHash,
        customerId: row.customer,
      });
    }
    if (row.sessionHash)
      await Session.deleteOne({
        tokenHash: row.sessionHash,
        principalId: row.customer,
      });
    if (row.address)
      await Address.deleteOne({ _id: row.address, customerId: row.customer });
    if (row.customer) await Cart.deleteOne({ _id: customerId(row.customer) });
    if (row.product)
      await Product.deleteOne({ _id: row.product, title: row.marker });
    if (row.customer)
      await Customer.deleteOne({ _id: row.customer, name: row.marker });
  }
  await mongoose.disconnect();
}
