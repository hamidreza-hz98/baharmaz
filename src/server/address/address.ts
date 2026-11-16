import "server-only";
import mongoose, { Schema } from "mongoose";
import {
  normalizeDigits,
  normalizeIranianMobile,
} from "../../shared/locale.ts";
import type { AddressInput } from "../../shared/address.ts";
const schema = new Schema(
  {
    customerId: { type: String, required: true },
    label: { type: String, required: true },
    postalCode: { type: String, default: "" },
    recipient: { type: String, required: true },
    mobile: { type: String, required: true },
    address: { type: String, required: true },
    coordinates: { lat: Number, lng: Number },
    revision: { type: Number, default: 0 },
  },
  { timestamps: true, autoIndex: false, versionKey: false },
);
schema.index({ customerId: 1, createdAt: -1, _id: -1 });
export const Address =
  mongoose.models.Address || mongoose.model("Address", schema);
export class AddressNotFound extends Error {}
export class AddressConflict extends Error {}
function identifier(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f\d]{24}$/i.test(value))
    throw new RangeError("Invalid id");
  return value.toLowerCase();
}
function string(value: unknown, min: number, max: number): string {
  if (typeof value !== "string") throw new RangeError("Invalid text");
  const result = value.trim().normalize("NFKC");
  if (
    result.length < min ||
    result.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)
  )
    throw new RangeError("Invalid text");
  return result;
}
export function validateCoordinates(
  value: unknown,
): AddressInput["coordinates"] {
  if (value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new RangeError("Invalid coordinates");
  const c = value as Record<string, unknown>;
  if (
    Object.keys(c).some((k) => !["lat", "lng"].includes(k)) ||
    typeof c.lat !== "number" ||
    typeof c.lng !== "number" ||
    !Number.isFinite(c.lat) ||
    !Number.isFinite(c.lng) ||
    c.lat < -90 ||
    c.lat > 90 ||
    c.lng < -180 ||
    c.lng > 180
  )
    throw new RangeError("Invalid coordinates");
  return { lat: c.lat, lng: c.lng };
}
export function validateAddress(input: Record<string, unknown>): AddressInput {
  if (
    Object.keys(input).some(
      (k) =>
        ![
          "label",
          "postalCode",
          "recipient",
          "mobile",
          "address",
          "coordinates",
        ].includes(k),
    )
  )
    throw new RangeError("Unknown field");
  const postalCode = normalizeDigits(string(input.postalCode ?? "", 0, 10));
  if (postalCode && !/^\d{10}$/.test(postalCode))
    throw new RangeError("Invalid postal code");
  return {
    label: string(input.label, 2, 80),
    postalCode,
    recipient: string(input.recipient, 2, 120),
    mobile: normalizeIranianMobile(string(input.mobile, 10, 30)),
    address: string(input.address, 8, 1000),
    coordinates: validateCoordinates(input.coordinates),
  };
}
function output(item: {
  _id: unknown;
  label: string;
  postalCode: string;
  recipient: string;
  mobile: string;
  address: string;
  coordinates?: { lat?: number; lng?: number } | null;
  revision: number;
}) {
  const c = item.coordinates;
  return {
    id: String(item._id),
    label: item.label,
    postalCode: item.postalCode,
    recipient: item.recipient,
    mobile: item.mobile,
    address: item.address,
    coordinates:
      c && typeof c.lat === "number" && typeof c.lng === "number"
        ? { lat: c.lat, lng: c.lng }
        : null,
    revision: item.revision,
  };
}
export async function listAddresses(customerId: string) {
  const rows = await Address.find({ customerId: identifier(customerId) })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  return rows.map(output);
}
export async function createAddress(
  customerId: string,
  input: Record<string, unknown>,
) {
  const values = validateAddress(input);
  const item = await Address.create({
    ...values,
    customerId: identifier(customerId),
  });
  return output(item);
}
export async function updateAddress(
  customerId: string,
  id: string,
  revision: unknown,
  input: Record<string, unknown>,
) {
  const owner = identifier(customerId),
    target = identifier(id);
  if (
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    throw new RangeError("Invalid revision");
  const values = validateAddress(input);
  const item = await Address.findOneAndUpdate(
    { _id: target, customerId: owner, revision },
    { $set: values, $inc: { revision: 1 } },
    { new: true, runValidators: true },
  ).lean();
  if (item) return output(item);
  if (await Address.exists({ _id: target, customerId: owner }))
    throw new AddressConflict();
  throw new AddressNotFound();
}
export async function deleteAddress(
  customerId: string,
  id: string,
  revision: unknown,
) {
  const owner = identifier(customerId),
    target = identifier(id);
  if (
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    throw new RangeError("Invalid revision");
  const result = await Address.deleteOne({
    _id: target,
    customerId: owner,
    revision,
  });
  if (result.deletedCount) return;
  if (await Address.exists({ _id: target, customerId: owner }))
    throw new AddressConflict();
  throw new AddressNotFound();
}
