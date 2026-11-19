import "server-only";
import mongoose, { Schema } from "mongoose";
const item = new Schema(
  {
    title: String,
    quantity: Number,
    unitRials: Number,
    lineRials: Number,
    imageId: String,
  },
  { _id: false },
);
const schema = new Schema(
  {
    code: { type: String, required: true, immutable: true },
    customerId: { type: String, required: true, immutable: true },
    status: String,
    isTest: { type: Boolean, default: false, immutable: true },
    placedAt: { type: Date, immutable: true },
    items: { type: [item], immutable: true },
    customer: { type: Schema.Types.Mixed, immutable: true },
    address: { type: Schema.Types.Mixed, immutable: true },
    delivery: { type: Schema.Types.Mixed, immutable: true },
    payment: { type: Schema.Types.Mixed, immutable: true },
    totals: { type: Schema.Types.Mixed, immutable: true },
    adminRevision: { type: Number, default: 0 },
    adminNote: { type: String, default: "", maxlength: 1000 },
    adminChanges: { type: [Schema.Types.Mixed], default: [] },
  },
  { versionKey: false, autoIndex: false, strict: true, collection: "orders" },
);
schema.index({ code: 1 }, { unique: true });
schema.index({ customerId: 1, placedAt: -1, _id: -1 });
schema.index({ placedAt: -1, _id: -1 });
schema.index({ status: 1, placedAt: -1, _id: -1 });
schema.index({ "payment.status": 1 });
export const Order =
  mongoose.models.CustomerOrderView ||
  mongoose.model("CustomerOrderView", schema);
export class OrderNotFound extends Error {}
function ownerId(value: string) {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new RangeError("Invalid owner");
  return value.toLowerCase();
}
function orderCode(value: string) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(value))
    throw new RangeError("Invalid code");
  return value;
}
export function orderSnapshot(row: {
  code: string;
  status: string;
  isTest?: boolean;
  placedAt: Date;
  items: {
    title: string;
    quantity: number;
    unitRials: number;
    lineRials: number;
    imageId?: string;
  }[];
  customer?: unknown;
  address?: unknown;
  delivery?: unknown;
  payment?: unknown;
  totals?: unknown;
}) {
  if (
    !(row.placedAt instanceof Date) ||
    Number.isNaN(row.placedAt.getTime()) ||
    !Array.isArray(row.items) ||
    !["preparing", "delivered", "cancelled"].includes(row.status)
  )
    throw new Error("Invalid order snapshot");
  const field = (value: unknown) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const string = (value: unknown) => (typeof value === "string" ? value : "");
  const money = (value: unknown) =>
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value % 10 === 0
      ? value
      : null;
  const customer = field(row.customer),
    address = field(row.address),
    delivery = field(row.delivery),
    payment = field(row.payment),
    totals = field(row.totals);
  const rawVerified = payment.verifiedAt;
  const timestamp =
    rawVerified instanceof Date
      ? rawVerified
      : typeof rawVerified === "string"
        ? new Date(rawVerified)
        : null;
  const verified =
    payment.status === "verified" &&
    timestamp !== null &&
    !Number.isNaN(timestamp.getTime());
  return {
    code: row.code,
    isTest: row.isTest === true,
    status: row.status,
    placedAt: row.placedAt,
    items: row.items.map((i) => {
      if (
        typeof i.title !== "string" ||
        !Number.isSafeInteger(i.quantity) ||
        i.quantity < 1 ||
        money(i.unitRials) === null ||
        money(i.lineRials) === null
      )
        throw new Error("Invalid order item snapshot");
      return {
        title: i.title,
        quantity: i.quantity,
        unitRials: i.unitRials,
        lineRials: i.lineRials,
        imageId:
          typeof i.imageId === "string" && /^[a-f\d]{24}$/i.test(i.imageId)
            ? i.imageId
            : null,
      };
    }),
    customer: { name: string(customer.name), mobile: string(customer.mobile) },
    address: {
      recipient: string(address.recipient),
      mobile: string(address.mobile),
      address: string(address.address),
      postalCode: string(address.postalCode),
    },
    delivery: {
      date: string(delivery.date),
      slotLabel: string(delivery.slotLabel),
    },
    payment: {
      status:
        row.isTest && payment.status === "sandbox_verified"
          ? "sandbox_verified"
          : verified
            ? "verified"
            : payment.status === "failed"
              ? "failed"
              : "pending",
      transactionReference: string(payment.transactionReference),
      verifiedAt: verified ? timestamp.toISOString() : null,
    },
    totals: {
      subtotalRials: money(totals.subtotalRials),
      discountRials: money(totals.discountRials),
      shippingRials: money(totals.shippingRials),
      totalRials: money(totals.totalRials),
      paidRials: verified ? money(totals.paidRials) : null,
    },
  };
}
export async function listOrders(
  customer: string,
  status: string,
  page: number,
) {
  if (
    !["all", "preparing", "delivered", "cancelled"].includes(status) ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 1000
  )
    throw new RangeError("Invalid filter");
  const filter: Record<string, unknown> = { customerId: ownerId(customer) };
  if (status !== "all") filter.status = status;
  const [rows, total] = await Promise.all([
    Order.find(filter)
      .sort({ placedAt: -1, _id: -1 })
      .skip((page - 1) * 20)
      .limit(20)
      .lean(),
    Order.countDocuments(filter),
  ]);
  return { items: rows.map(orderSnapshot), total, page, limit: 20 };
}
export async function getOrder(customer: string, code: string) {
  const row = await Order.findOne({
    customerId: ownerId(customer),
    code: orderCode(code),
  }).lean();
  if (!row) throw new OrderNotFound();
  return orderSnapshot(row);
}
