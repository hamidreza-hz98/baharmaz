import "server-only";
import { createHash, randomBytes } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import { Address } from "../address/address.ts";
import { customerId as cartCustomerId, readCart } from "../cart/cart.ts";
import { sumRials } from "../../shared/locale.ts";
import {
  validatePolicy,
  availableDays,
  zoneFor,
  canonicalDate,
} from "./policy.ts";
const policySchema = new Schema(
  {
    _id: String,
    revision: { type: Number, default: 0 },
    active: { type: Boolean, default: false },
    policy: { type: Schema.Types.Mixed, default: null },
  },
  { versionKey: false, timestamps: true, autoIndex: false },
);
const quoteSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    customerId: { type: String, required: true },
    addressId: { type: String, required: true },
    addressRevision: { type: Number, required: true },
    policyRevision: { type: Number, required: true },
    cartFingerprint: { type: String, required: true },
    date: { type: String, required: true },
    slotId: { type: String, required: true },
    zoneId: { type: String, required: true },
    shippingRials: { type: Number, required: true },
    itemsTotalRials: { type: Number, required: true },
    totalRials: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, timestamps: true, autoIndex: false },
);
quoteSchema.index({ tokenHash: 1 }, { unique: true });
quoteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const DeliverySettings =
  mongoose.models.DeliverySettings ||
  mongoose.model("DeliverySettings", policySchema);
export const DeliveryQuote =
  mongoose.models.DeliveryQuote || mongoose.model("DeliveryQuote", quoteSchema);
export class DeliveryConflict extends Error {}
export class DeliveryNotFound extends Error {}
export class DeliveryUnavailable extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}
const validId = (id: unknown) => {
  if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id))
    throw new RangeError("Invalid id");
  return id.toLowerCase();
};
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function getPolicy() {
  const stored = await DeliverySettings.findById("active").lean();
  if (!stored) return { revision: 0, active: false, policy: null };
  if (!stored.active)
    return { revision: stored.revision as number, active: false, policy: null };
  return {
    revision: stored.revision as number,
    active: true,
    policy: validatePolicy(stored.policy),
  };
}
export async function savePolicy(input: unknown, revision: unknown) {
  if (
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    throw new RangeError("Invalid revision");
  const policy = input === null ? null : validatePolicy(input);
  try {
    const filter =
      revision === 0
        ? {
            _id: "active",
            $or: [{ revision: 0 }, { revision: { $exists: false } }],
          }
        : { _id: "active", revision };
    const result = await DeliverySettings.findOneAndUpdate(
      filter,
      { $set: { active: policy !== null, policy }, $inc: { revision: 1 } },
      { upsert: revision === 0, new: true, setDefaultsOnInsert: false },
    ).lean();
    if (!result) throw new DeliveryConflict();
    return { revision: result.revision as number, active: !!policy, policy };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    )
      throw new DeliveryConflict();
    throw error;
  }
}
async function addressFor(customer: string, addressId: string) {
  const row = await Address.findOne({
    _id: validId(addressId),
    customerId: validId(customer),
  })
    .select("revision coordinates")
    .lean();
  if (!row) throw new DeliveryNotFound();
  return row;
}
function fingerprint(cart: Awaited<ReturnType<typeof readCart>>) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        revision: cart.revision,
        items: cart.items
          .map((x) => ({
            id: x.productId,
            quantity: x.quantity,
            status: x.status,
            changed: x.priceChanged,
            capped: x.quantityCapped,
            regular: x.regularRials,
            sale: x.saleRials,
          }))
          .sort((a, b) => a.id.localeCompare(b.id)),
      }),
    )
    .digest("hex");
}
async function cartFor(customer: string) {
  const cart = await readCart(cartCustomerId(validId(customer)));
  if (
    !cart.items.length ||
    cart.items.some(
      (x) => x.status !== "available" || x.priceChanged || x.quantityCapped,
    )
  )
    throw new DeliveryUnavailable("cart_changed");
  return cart;
}
export async function deliveryOptions(
  customer: string,
  addressId: string,
  now = Date.now(),
) {
  const setting = await getPolicy();
  if (!setting.active || !setting.policy)
    return { status: "not_configured" as const, days: [] };
  const address = await addressFor(customer, addressId);
  if (
    !address.coordinates ||
    typeof address.coordinates.lat !== "number" ||
    typeof address.coordinates.lng !== "number"
  )
    return { status: "coordinates_required" as const, days: [] };
  const match = zoneFor(setting.policy.zones, {
    lat: address.coordinates.lat,
    lng: address.coordinates.lng,
  });
  if (match.status !== "covered") return { status: match.status, days: [] };
  const days = availableDays(setting.policy, now);
  return {
    status: "covered" as const,
    zone: { id: match.zone.id, name: match.zone.name },
    days,
  };
}
export async function createQuote(
  customer: string,
  addressId: string,
  date: unknown,
  slotId: unknown,
  now = Date.now(),
) {
  const parsed = canonicalDate(date);
  if (typeof slotId !== "string" || !/^[a-z0-9_-]{1,64}$/i.test(slotId))
    throw new RangeError("Invalid slot");
  const settings = await getPolicy();
  if (!settings.active || !settings.policy)
    throw new DeliveryUnavailable("not_configured");
  const address = await addressFor(customer, addressId);
  if (
    !address.coordinates ||
    typeof address.coordinates.lat !== "number" ||
    typeof address.coordinates.lng !== "number"
  )
    throw new DeliveryUnavailable("coordinates_required");
  const match = zoneFor(settings.policy.zones, {
    lat: address.coordinates.lat,
    lng: address.coordinates.lng,
  });
  if (match.status !== "covered") throw new DeliveryUnavailable(match.status);
  const slot = availableDays(settings.policy, now)
    .find((d) => d.date === parsed)
    ?.slots.find((s) => s.id === slotId);
  if (!slot?.available) throw new DeliveryUnavailable("slot_unavailable");
  const cart = await cartFor(customer);
  const shippingRials = match.zone.feeRials;
  const totalRials = sumRials([cart.itemsTotalRials, shippingRials]);
  const indexes = await DeliveryQuote.collection.indexes().catch(() => []);
  if (
    !indexes.some(
      (index) =>
        index.unique === true &&
        Object.keys(index.key).length === 1 &&
        index.key.tokenHash === 1,
    ) ||
    !indexes.some(
      (index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0,
    )
  )
    throw new Error("Delivery quote indexes are missing.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now + settings.policy.quoteTtlSeconds * 1000);
  await DeliveryQuote.create({
    tokenHash: digest(token),
    customerId: validId(customer),
    addressId: validId(addressId),
    addressRevision: address.revision,
    policyRevision: settings.revision,
    cartFingerprint: fingerprint(cart),
    date: parsed,
    slotId,
    zoneId: match.zone.id,
    shippingRials,
    itemsTotalRials: cart.itemsTotalRials,
    totalRials,
    expiresAt,
  });
  return {
    token,
    date: parsed,
    slot,
    zone: match.zone.name,
    shippingRials,
    itemsTotalRials: cart.itemsTotalRials,
    totalRials,
    expiresAt,
  };
}
export async function validateQuote(
  customer: string,
  token: unknown,
  now = Date.now(),
) {
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new RangeError("Invalid quote");
  const q = await DeliveryQuote.findOne({
    tokenHash: digest(token),
    customerId: validId(customer),
    expiresAt: { $gt: new Date(now) },
  }).lean();
  if (!q) throw new DeliveryUnavailable("quote_expired");
  try {
    const [settings, address, cart] = await Promise.all([
      getPolicy(),
      addressFor(customer, q.addressId),
      cartFor(customer),
    ]);
    if (
      !settings.active ||
      !settings.policy ||
      settings.revision !== q.policyRevision ||
      address.revision !== q.addressRevision ||
      fingerprint(cart) !== q.cartFingerprint
    )
      throw new DeliveryUnavailable("quote_changed");
    const match =
      address.coordinates &&
      typeof address.coordinates.lat === "number" &&
      typeof address.coordinates.lng === "number"
        ? zoneFor(settings.policy.zones, {
            lat: address.coordinates.lat,
            lng: address.coordinates.lng,
          })
        : null;
    const slot = availableDays(settings.policy, now)
      .find((d) => d.date === q.date)
      ?.slots.find((s) => s.id === q.slotId);
    if (
      !match ||
      match.status !== "covered" ||
      match.zone.id !== q.zoneId ||
      match.zone.feeRials !== q.shippingRials ||
      !slot?.available ||
      sumRials([cart.itemsTotalRials, q.shippingRials]) !== q.totalRials
    )
      throw new DeliveryUnavailable("quote_changed");
    return {
      date: q.date,
      slot,
      zone: match.zone.name,
      shippingRials: q.shippingRials,
      itemsTotalRials: q.itemsTotalRials,
      totalRials: q.totalRials,
      expiresAt: q.expiresAt,
    };
  } catch (error) {
    if (
      error instanceof DeliveryNotFound ||
      error instanceof DeliveryUnavailable
    )
      throw new DeliveryUnavailable("quote_changed");
    throw error;
  }
}
