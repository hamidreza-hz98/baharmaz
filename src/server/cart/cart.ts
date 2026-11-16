import "server-only";
import { createHash, randomBytes } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import { Product } from "../products/products.ts";
import { multiplyRials, sumRials } from "../../shared/locale.ts";
const lineSchema = new Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, required: true },
    observedPriceRials: { type: Number, default: null },
    observedRegularRials: { type: Number, default: null },
    quantityCapped: { type: Boolean, default: false },
  },
  { _id: false },
);
const schema = new Schema(
  {
    _id: String,
    lines: { type: [lineSchema], default: [] },
    revision: { type: Number, default: 0 },
    lockedTo: { type: String, default: null },
    mergedGuests: { type: [String], default: [] },
    importedDrafts: { type: [String], default: [] },
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, autoIndex: false },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Cart =
  mongoose.models.ShoppingCart || mongoose.model("ShoppingCart", schema);
export class CartConflict extends Error {}
export class CartUnavailable extends Error {}
type Line = {
  productId: string;
  quantity: number;
  observedPriceRials: number | null;
  observedRegularRials: number | null;
  quantityCapped?: boolean;
};
const MAX_QTY = 99,
  MAX_LINES = 50,
  MAX_LEDGER = 1000;
export function guestToken() {
  return randomBytes(32).toString("base64url");
}
export function guestId(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new RangeError("Invalid guest token");
  return `guest:${createHash("sha256").update(token).digest("hex")}`;
}
export function customerId(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new RangeError("Invalid customer");
  return `customer:${id.toLowerCase()}`;
}
function productId(id: unknown) {
  if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id))
    throw new RangeError("Invalid product");
  return id.toLowerCase();
}
function quantity(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_QTY
  )
    throw new RangeError("Invalid quantity");
  return value;
}
function safeLines(items: Line[]): Line[] {
  return items.map((line) => ({
    productId: line.productId,
    quantity: line.quantity,
    observedPriceRials: line.observedPriceRials ?? null,
    observedRegularRials: line.observedRegularRials ?? null,
    quantityCapped: line.quantityCapped === true,
  }));
}
async function ensure(id: string) {
  try {
    await Cart.updateOne(
      { _id: id },
      {
        $setOnInsert: {
          lines: [],
          revision: 0,
          lockedTo: null,
          mergedGuests: [],
          importedDrafts: [],
          expiresAt: id.startsWith("guest:")
            ? new Date(Date.now() + 90 * 86400000)
            : null,
        },
      },
      { upsert: true },
    );
  } catch (e) {
    if (!(
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      e.code === 11000
    ))
      throw e;
  }
}
async function productSnapshot(id: string) {
  const p = await Product.findOne({ _id: id, deletedAt: null })
    .select("priceRials discountPriceRials available")
    .lean();
  if (!p || !p.available) throw new CartUnavailable();
  return {
    observedPriceRials: p.discountPriceRials ?? p.priceRials,
    observedRegularRials: p.priceRials,
  };
}
async function mutate(
  id: string,
  change: (
    lines: Line[],
    doc: { mergedGuests: string[]; importedDrafts: string[] },
  ) => Promise<{
    lines: Line[];
    mergedGuests?: string[];
    importedDrafts?: string[];
  }>,
) {
  await ensure(id);
  for (let attempt = 0; attempt < 8; attempt++) {
    const doc = await Cart.findById(id).lean();
    if (!doc || doc.lockedTo) throw new CartConflict();
    const state = await change(safeLines(doc.lines), {
      mergedGuests: doc.mergedGuests ?? [],
      importedDrafts: doc.importedDrafts ?? [],
    });
    if (state.lines.length > MAX_LINES) throw new RangeError("Too many lines");
    const result = await Cart.updateOne(
      { _id: id, revision: doc.revision, lockedTo: null },
      { $set: state, $inc: { revision: 1 } },
    );
    if (result.modifiedCount) return;
  }
  throw new CartConflict();
}
export async function changeCart(
  id: string,
  action: string,
  input: Record<string, unknown>,
) {
  const target = productId(input.productId);
  if (!["add", "set", "remove", "acknowledge"].includes(action))
    throw new RangeError("Invalid action");
  const qty =
    action === "add" || action === "set" ? quantity(input.quantity) : 0;
  await mutate(id, async (lines) => {
    const index = lines.findIndex((l) => l.productId === target);
    if (action === "remove") {
      if (index >= 0) lines.splice(index, 1);
      return { lines };
    }
    if (action === "acknowledge" && index < 0)
      throw new RangeError("Missing line");
    const snapshot = await productSnapshot(target);
    if (index < 0) {
      if (action !== "add" && action !== "set")
        throw new RangeError("Missing line");
      lines.push({ productId: target, quantity: qty, ...snapshot });
    } else if (action === "add") {
      const next = lines[index].quantity + qty;
      if (next > MAX_QTY) throw new RangeError("Quantity limit");
      lines[index].quantity = next;
    } else if (action === "set") {
      lines[index].quantity = qty;
      lines[index].quantityCapped = false;
    } else Object.assign(lines[index], snapshot);
    return { lines };
  });
}
export async function mergeGuest(guest: string, customer: string) {
  await ensure(guest);
  await ensure(customer);
  const locked = await Cart.findOneAndUpdate(
    { _id: guest, $or: [{ lockedTo: null }, { lockedTo: customer }] },
    { $set: { lockedTo: customer } },
    { new: true },
  ).lean();
  if (!locked) throw new CartConflict();
  await mutate(customer, async (lines, doc) => {
    if (doc.mergedGuests.includes(guest)) return { lines };
    if (doc.mergedGuests.length >= MAX_LEDGER) throw new CartConflict();
    const draftIds: string[] = locked.importedDrafts ?? [];
    if (
      draftIds.some((draft) => doc.importedDrafts.includes(draft)) ||
      doc.importedDrafts.length + draftIds.length > MAX_LEDGER
    )
      throw new CartConflict();
    for (const entry of safeLines(locked.lines)) {
      const current = lines.find((x) => x.productId === entry.productId);
      if (current) {
        const sum = current.quantity + entry.quantity;
        current.quantityCapped =
          current.quantityCapped || entry.quantityCapped || sum > MAX_QTY;
        current.quantity = Math.min(MAX_QTY, sum);
        if (
          current.observedPriceRials !== entry.observedPriceRials ||
          current.observedRegularRials !== entry.observedRegularRials
        ) {
          current.observedPriceRials = null;
          current.observedRegularRials = null;
        }
      } else lines.push(entry);
    }
    return {
      lines,
      mergedGuests: [...doc.mergedGuests, guest],
      importedDrafts: [...doc.importedDrafts, ...draftIds],
    };
  });
  await Cart.deleteOne({ _id: guest, lockedTo: customer });
}
export async function importDraft(id: string, token: unknown, raw: unknown) {
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{32}$/.test(token) ||
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw)
  )
    throw new RangeError("Invalid draft");
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_LINES) throw new RangeError("Too many draft lines");
  const sanitized = entries.map(([id, value]) => ({
    productId: productId(id),
    quantity: quantity(value),
  }));
  await mutate(id, async (lines, doc) => {
    if (doc.importedDrafts.includes(token)) return { lines };
    if (doc.importedDrafts.length >= MAX_LEDGER) throw new CartConflict();
    for (const entry of sanitized) {
      const existing = lines.find((x) => x.productId === entry.productId);
      if (existing) {
        existing.quantityCapped =
          existing.quantityCapped ||
          existing.quantity + entry.quantity > MAX_QTY;
        existing.quantity = Math.min(
          MAX_QTY,
          existing.quantity + entry.quantity,
        );
        continue;
      }
      let snapshot;
      try {
        snapshot = await productSnapshot(entry.productId);
      } catch (error) {
        if (!(error instanceof CartUnavailable)) throw error;
        snapshot = { observedPriceRials: null, observedRegularRials: null };
      }
      lines.push({ ...entry, ...snapshot });
    }
    return { lines, importedDrafts: [...doc.importedDrafts, token] };
  });
}
export async function readCart(id: string) {
  await ensure(id);
  const doc = await Cart.findById(id).lean();
  if (!doc || doc.lockedTo) throw new CartConflict();
  const lines = safeLines(doc.lines);
  const products = await Product.find({
    _id: { $in: lines.map((x) => x.productId) },
  })
    .select(
      "title slug gallery priceRials discountPriceRials available deletedAt",
    )
    .lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));
  const subtotal: number[] = [];
  const discounts: number[] = [];
  const items = lines.map((line) => {
    const p = byId.get(line.productId);
    const status =
      !p || p.deletedAt
        ? "removed"
        : !p.available
          ? "unavailable"
          : "available";
    if (status !== "available" || !p)
      return {
        ...line,
        title: p?.title ?? "محصول حذف‌شده",
        slug: null,
        image: null,
        status,
        priceChanged: false,
        regularRials: null,
        saleRials: null,
        lineRials: null,
      };
    const sale = p.discountPriceRials ?? p.priceRials;
    subtotal.push(multiplyRials(p.priceRials, line.quantity));
    discounts.push(multiplyRials(p.priceRials - sale, line.quantity));
    return {
      ...line,
      title: p.title,
      slug: p.slug,
      image: p.gallery?.[0] ?? null,
      status,
      priceChanged:
        line.observedPriceRials !== sale ||
        line.observedRegularRials !== p.priceRials,
      regularRials: p.priceRials,
      saleRials: sale,
      lineRials: multiplyRials(sale, line.quantity),
    };
  });
  const subtotalRials = sumRials(subtotal),
    discountRials = sumRials(discounts);
  return {
    items,
    subtotalRials,
    discountRials,
    shippingRials: null,
    totalRials: null,
    itemsTotalRials: subtotalRials - discountRials,
    checkoutReady: false,
    revision: doc.revision,
  };
}
