import "server-only";
import { Customer } from "@/server/identity/identity";
import { Address } from "@/server/address/address";
import { Product } from "@/server/products/products";
import { getPolicy } from "@/server/delivery/delivery";
import {
  availableDays,
  canonicalDate,
  zoneFor,
} from "@/server/delivery/policy";
import { multiplyRials, sumRials } from "@/shared/locale";
export class ManualUnavailable extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}
function id(value: unknown) {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
    throw new RangeError("Invalid identifier");
  return value.toLowerCase();
}
export async function manualAddresses(customer: unknown) {
  const customerId = id(customer);
  if (!(await Customer.exists({ _id: customerId })))
    throw new ManualUnavailable("customer_missing");
  const rows = await Address.find({ customerId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(101)
    .select("label recipient address revision")
    .lean();
  if (rows.length > 100) throw new ManualUnavailable("too_many_addresses");
  return rows.map((row) => ({
    id: String(row._id),
    label: row.label,
    recipient: row.recipient,
    address: row.address,
  }));
}
async function deliveryContext(
  customer: unknown,
  address: unknown,
  now = Date.now(),
) {
  const customerId = id(customer),
    addressId = id(address);
  const [owner, destination, settings] = await Promise.all([
    Customer.findById(customerId).select("name mobile").lean(),
    Address.findOne({ _id: addressId, customerId }).lean(),
    getPolicy(),
  ]);
  if (!owner) throw new ManualUnavailable("customer_missing");
  if (!destination) throw new ManualUnavailable("address_missing");
  if (!settings.active || !settings.policy)
    throw new ManualUnavailable("not_configured");
  const coords = destination.coordinates;
  if (
    !coords ||
    typeof coords.lat !== "number" ||
    typeof coords.lng !== "number"
  )
    throw new ManualUnavailable("coordinates_required");
  const zone = zoneFor(settings.policy.zones, {
    lat: coords.lat,
    lng: coords.lng,
  });
  if (zone.status !== "covered") throw new ManualUnavailable(zone.status);
  return {
    owner,
    destination,
    zone: zone.zone,
    days: availableDays(settings.policy, now),
  };
}
export async function manualOptions(customer: unknown, address: unknown) {
  const ctx = await deliveryContext(customer, address);
  return { days: ctx.days, zone: ctx.zone.name };
}
export async function previewManualOrder(input: Record<string, unknown>) {
  if (
    Object.keys(input).some(
      (key) =>
        ![
          "action",
          "customerId",
          "addressId",
          "date",
          "slotId",
          "items",
          "transfer",
        ].includes(key),
    )
  )
    throw new RangeError("Unknown input");
  const date = canonicalDate(input.date);
  if (
    typeof input.slotId !== "string" ||
    !/^[a-z0-9_-]{1,64}$/i.test(input.slotId)
  )
    throw new RangeError("Invalid slot");
  if (
    !Array.isArray(input.items) ||
    input.items.length < 1 ||
    input.items.length > 50 ||
    !["unreported", "reported", "admin_confirmed"].includes(
      String(input.transfer),
    )
  )
    throw new RangeError("Invalid selection");
  const lines = input.items.map((value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new RangeError("Invalid line");
    const row = value as Record<string, unknown>;
    if (
      Object.keys(row).some(
        (key) => !["productId", "quantity"].includes(key),
      ) ||
      typeof row.quantity !== "number" ||
      !Number.isSafeInteger(row.quantity) ||
      row.quantity < 1 ||
      row.quantity > 99
    )
      throw new RangeError("Invalid quantity");
    return { productId: id(row.productId), quantity: row.quantity };
  });
  if (new Set(lines.map((line) => line.productId)).size !== lines.length)
    throw new RangeError("Duplicate product");
  const [ctx, products] = await Promise.all([
    deliveryContext(input.customerId, input.addressId),
    Product.find({
      _id: { $in: lines.map((line) => line.productId) },
      deletedAt: null,
      available: true,
    })
      .select("title priceRials discountPriceRials")
      .lean(),
  ]);
  const slot = ctx.days
    .find((day) => day.date === date)
    ?.slots.find((item) => item.id === input.slotId);
  if (!slot?.available) throw new ManualUnavailable("slot_unavailable");
  const byId = new Map(
    products.map((product) => [String(product._id), product]),
  );
  const items = lines.map((line) => {
    const product = byId.get(line.productId);
    if (!product) throw new ManualUnavailable("product_unavailable");
    const regular = product.priceRials,
      sale = product.discountPriceRials ?? regular;
    if (
      !Number.isSafeInteger(regular) ||
      !Number.isSafeInteger(sale) ||
      regular <= 0 ||
      sale <= 0 ||
      sale > regular ||
      regular % 10 ||
      sale % 10
    )
      throw new Error("Invalid product prices");
    return {
      productId: line.productId,
      title: product.title,
      quantity: line.quantity,
      regularRials: regular,
      unitRials: sale,
      lineRials: multiplyRials(sale, line.quantity),
    };
  });
  const subtotalRials = sumRials(
    items.map((item) => multiplyRials(item.regularRials, item.quantity)),
  );
  const itemsTotalRials = sumRials(items.map((item) => item.lineRials));
  const shippingRials = ctx.zone.feeRials;
  return {
    customer: { name: ctx.owner.name, mobile: ctx.owner.mobile },
    address: {
      label: ctx.destination.label,
      recipient: ctx.destination.recipient,
      address: ctx.destination.address,
    },
    delivery: { date, slotLabel: slot.label, zone: ctx.zone.name },
    items,
    subtotalRials,
    discountRials: subtotalRials - itemsTotalRials,
    shippingRials,
    totalRials: sumRials([itemsTotalRials, shippingRials]),
    transfer: input.transfer,
    readyToCreate: false,
  };
}
