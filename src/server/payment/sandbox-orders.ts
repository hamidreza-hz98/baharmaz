import "server-only";
import { createHash, randomBytes } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import { Order } from "../orders/orders.ts";
import { Cart, customerId, readCart } from "../cart/cart.ts";
import { Address } from "../address/address.ts";
import { getCustomerProfile } from "../account/account.ts";
import {
  DeliveryQuote,
  validateQuote,
  DeliveryUnavailable,
  cartFingerprint,
} from "../delivery/delivery.ts";
import {
  createAqayeAdapter,
  parsePaymentConfig,
  providerAmount,
} from "./aqaye.ts";

const schema = new Schema(
  {
    _id: String,
    code: { type: String, required: true },
    customerId: { type: String, required: true },
    callbackHash: { type: String, required: true },
    transid: { type: String },
    state: { type: String, required: true },
    verifyLeaseUntil: { type: Date, default: null },
    cartRevision: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    verifiedAt: { type: Date, default: null },
  },
  {
    collection: "sandbox_checkouts",
    timestamps: true,
    versionKey: false,
    autoIndex: false,
  },
);
schema.index({ code: 1 }, { unique: true });
schema.index({ callbackHash: 1 }, { unique: true });
schema.index(
  { transid: 1 },
  { unique: true, partialFilterExpression: { transid: { $type: "string" } } },
);
schema.index({ customerId: 1, createdAt: -1 });
export const SandboxCheckout =
  mongoose.models.SandboxCheckout || mongoose.model("SandboxCheckout", schema);
export async function materializeSandboxOrder(code: string) {
  const row = await SandboxCheckout.findOne({ code, state: "verified" }).lean();
  if (!row) return false;
  const snapshot = row.snapshot;
  await Order.collection.createIndex({ code: 1 }, { unique: true });
  await Order.updateOne(
    { code: row.code },
    {
      $setOnInsert: {
        code: row.code,
        customerId: row.customerId,
        isTest: true,
        status: "preparing",
        placedAt: row.createdAt,
        customer: snapshot.customer,
        address: snapshot.address,
        delivery: {
          date: snapshot.delivery.date,
          slotLabel: snapshot.delivery.slot?.label ?? "",
        },
        items: snapshot.items.map(
          (item: {
            title: string;
            image?: string | null;
            quantity: number;
            unitRials: number;
            lineRials: number;
          }) => ({
            title: item.title,
            imageId: item.image ?? null,
            quantity: item.quantity,
            unitRials: item.unitRials,
            lineRials: item.lineRials,
          }),
        ),
        payment: {
          status: "sandbox_verified",
          transactionReference: row.transid ?? "",
        },
        totals: {
          subtotalRials: snapshot.subtotalRials,
          discountRials: snapshot.discountRials,
          shippingRials: snapshot.delivery.shippingRials,
          totalRials: snapshot.delivery.totalRials,
          paidRials: null,
        },
        adminRevision: 0,
        adminNote: "",
        adminChanges: [],
      },
    },
    { upsert: true },
  );
  return true;
}
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const codePattern = /^TEST-[A-F0-9]{16}$/;
const transidPattern = /^[A-Za-z0-9_-]{1,128}$/;

function paymentConfig(callbackToken?: string) {
  const config = parsePaymentConfig();
  if (callbackToken)
    config.callback = `${config.callback.replace(/\/$/, "")}/${callbackToken}`;
  return config;
}
export function sandboxPaymentEnabled() {
  try {
    paymentConfig();
    return true;
  } catch {
    return false;
  }
}
function result(row: { code: string; state: string; transid?: string }) {
  return {
    code: row.code,
    state: row.state,
    ...(row.state === "pending" && row.transid
      ? {
          redirectUrl: `https://panel.aqayepardakht.ir/startpay/sandbox/${encodeURIComponent(row.transid)}`,
        }
      : {}),
  };
}
/** A quote is claimed once by its hash before contacting the sandbox. Unknown initiation outcomes are never retried automatically. */
export async function submitSandboxOrder(
  customer: string,
  token: string,
  fetcher: typeof fetch = fetch,
) {
  if (!/^[a-f\d]{24}$/i.test(customer) || !tokenPattern.test(token))
    throw new RangeError("Invalid checkout");
  paymentConfig();
  const key = digest(token);
  let existing = await SandboxCheckout.findById(key).lean();
  if (existing) {
    if (existing.customerId !== customer)
      throw new RangeError("Invalid checkout");
    return result(existing);
  }
  const quote = await validateQuote(customer, token);
  providerAmount(quote.totalRials);
  const stored = await DeliveryQuote.findOne({
    tokenHash: key,
    customerId: customer,
  })
    .select("addressId cartFingerprint")
    .lean();
  if (!stored) throw new DeliveryUnavailable("quote_expired");
  const [address, profile, cart] = await Promise.all([
    Address.findOne({ _id: stored.addressId, customerId: customer })
      .select("label recipient mobile address postalCode")
      .lean(),
    getCustomerProfile(customer),
    readCart(customerId(customer)),
  ]);
  if (!address || !profile || cartFingerprint(cart) !== stored.cartFingerprint)
    throw new DeliveryUnavailable("quote_changed");
  await validateQuote(customer, token);
  const callbackToken = randomBytes(32).toString("base64url");
  const code = `TEST-${randomBytes(8).toString("hex").toUpperCase()}`;
  await SandboxCheckout.createIndexes();
  try {
    await SandboxCheckout.create({
      _id: key,
      code,
      customerId: customer,
      callbackHash: digest(callbackToken),
      state: "initiating",
      cartRevision: cart.revision,
      snapshot: {
        customer: { name: profile.name, mobile: profile.mobile },
        address: {
          label: address.label,
          recipient: address.recipient,
          mobile: address.mobile,
          address: address.address,
          postalCode: address.postalCode,
        },
        items: cart.items.map((item) => ({
          title: item.title,
          image: item.image,
          quantity: item.quantity,
          unitRials: item.saleRials,
          lineRials: item.lineRials,
        })),
        subtotalRials: cart.subtotalRials,
        discountRials: cart.discountRials,
        delivery: quote,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      existing = await SandboxCheckout.findById(key).lean();
      if (existing && existing.customerId === customer) return result(existing);
    }
    throw error;
  }
  try {
    const payment = await createAqayeAdapter(
      paymentConfig(callbackToken),
      fetcher,
    ).create({ amountRials: quote.totalRials, invoiceId: code });
    const saved = await SandboxCheckout.findOneAndUpdate(
      { _id: key, state: "initiating" },
      { $set: { state: "pending", transid: payment.transid } },
      { new: true },
    ).lean();
    if (!saved) throw new Error("Payment initiation state changed");
    return result(saved);
  } catch {
    await SandboxCheckout.updateOne(
      { _id: key, state: "initiating" },
      { $set: { state: "unknown" } },
    );
    return { code, state: "unknown" };
  }
}

/** Callback data is only a hint: correlate against the stored sandbox transaction and verify with the provider. */
export async function finishSandboxPayment(
  reference: string,
  transid: string,
  status: string,
  fetcher: typeof fetch = fetch,
) {
  if (!tokenPattern.test(reference) || !transidPattern.test(transid))
    return null;
  const row = await SandboxCheckout.findOne({
    callbackHash: digest(reference),
    transid,
  }).lean();
  if (!row) return null;
  if (row.state === "verified") {
    await materializeSandboxOrder(row.code);
    return row.code as string;
  }
  if (row.state === "failed") return row.code as string;
  if (status !== "1") {
    if (status === "0" || status === "2")
      await SandboxCheckout.updateOne(
        { _id: row._id, state: "pending" },
        { $set: { state: "failed" } },
      );
    return row.code as string;
  }
  await verifySandboxOrder(row._id, transid, fetcher);
  return row.code as string;
}

async function verifySandboxOrder(
  id: string,
  transid: string,
  fetcher: typeof fetch,
) {
  const now = new Date();
  const claimed = await SandboxCheckout.findOneAndUpdate(
    {
      _id: id,
      transid,
      $or: [
        { state: "pending" },
        { state: "unknown" },
        { state: "verifying", verifyLeaseUntil: { $lt: now } },
      ],
    },
    {
      $set: {
        state: "verifying",
        verifyLeaseUntil: new Date(now.getTime() + 30000),
      },
    },
    { new: true },
  ).lean();
  if (!claimed) return;
  try {
    const verified = await createAqayeAdapter(paymentConfig(), fetcher).verify({
      amountRials: claimed.snapshot.delivery.totalRials,
      transid,
    });
    if (verified === "verified" || verified === "already_verified") {
      const update = await SandboxCheckout.updateOne(
        {
          _id: id,
          state: "verifying",
          verifyLeaseUntil: claimed.verifyLeaseUntil,
        },
        {
          $set: {
            state: "verified",
            verifiedAt: new Date(),
            verifyLeaseUntil: null,
          },
        },
      );
      if (update.modifiedCount)
        await Cart.updateOne(
          {
            _id: customerId(claimed.customerId),
            revision: claimed.cartRevision,
            lockedTo: null,
          },
          { $set: { lines: [] }, $inc: { revision: 1 } },
        );
      if (update.modifiedCount) await materializeSandboxOrder(claimed.code);
    } else {
      await SandboxCheckout.updateOne(
        {
          _id: id,
          state: "verifying",
          verifyLeaseUntil: claimed.verifyLeaseUntil,
        },
        { $set: { state: "unknown", verifyLeaseUntil: null } },
      );
    }
  } catch {
    await SandboxCheckout.updateOne(
      {
        _id: id,
        state: "verifying",
        verifyLeaseUntil: claimed.verifyLeaseUntil,
      },
      { $set: { state: "unknown", verifyLeaseUntil: null } },
    );
  }
}
export async function reconcileSandboxOrder(
  customer: string,
  code: string,
  fetcher: typeof fetch = fetch,
) {
  if (!/^[a-f\d]{24}$/i.test(customer) || !codePattern.test(code))
    throw new RangeError("Invalid order");
  const row = await SandboxCheckout.findOne({
    code,
    customerId: customer,
  }).lean();
  if (!row) return null;
  if (
    row.transid &&
    (row.state === "unknown" ||
      (row.state === "verifying" &&
        row.verifyLeaseUntil &&
        row.verifyLeaseUntil < new Date()))
  ) {
    await verifySandboxOrder(row._id, row.transid, fetcher);
  }
  return getSandboxOrder(customer, code);
}
export async function getSandboxOrder(customer: string, code: string) {
  if (!/^[a-f\d]{24}$/i.test(customer) || !codePattern.test(code))
    throw new RangeError("Invalid order");
  const row = await SandboxCheckout.findOne({
    code,
    customerId: customer,
  }).lean();
  if (!row) return null;
  if (row.state === "verified") await materializeSandboxOrder(row.code);
  return {
    code: row.code,
    state: row.state,
    createdAt: row.createdAt,
    verifiedAt: row.verifiedAt,
    snapshot: row.snapshot,
    ...(row.state === "pending" && row.transid
      ? {
          redirectUrl: `https://panel.aqayepardakht.ir/startpay/sandbox/${encodeURIComponent(row.transid)}`,
        }
      : {}),
  };
}
export async function listSandboxOrders(customer: string) {
  if (!/^[a-f\d]{24}$/i.test(customer))
    throw new RangeError("Invalid customer");
  const rows = await SandboxCheckout.find({ customerId: customer })
    .sort({ createdAt: -1 })
    .limit(20)
    .select("code state createdAt snapshot.delivery.totalRials snapshot.items")
    .lean();
  return rows.map((row) => ({
    code: row.code,
    state: row.state,
    createdAt: row.createdAt,
    totalRials: row.snapshot.delivery.totalRials,
    items: (row.snapshot.items ?? []).map(
      (item: {
        title: string;
        image?: string | null;
        quantity: number;
        lineRials: number;
      }) => ({
        title: item.title,
        image: item.image ?? null,
        quantity: item.quantity,
        lineRials: item.lineRials,
      }),
    ),
  }));
}

export async function listAdminSandboxOrders() {
  const rows = await SandboxCheckout.find({})
    .sort({ createdAt: -1 })
    .limit(50)
    .select("code state createdAt snapshot")
    .lean();
  return rows.map((row) => ({
    code: row.code,
    state: row.state,
    createdAt: row.createdAt,
    snapshot: row.snapshot,
  }));
}
