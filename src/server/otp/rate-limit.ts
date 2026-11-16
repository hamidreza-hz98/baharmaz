import "server-only";
import mongoose, { Schema } from "mongoose";
const schema = new Schema(
  {
    _id: String,
    count: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, autoIndex: false },
);
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const OtpRateBucket =
  mongoose.models.OtpRateBucket || mongoose.model("OtpRateBucket", schema);
/** A shared global ceiling avoids trusting spoofable client IP headers. */
export async function allowOtpRequest(now = Date.now()): Promise<boolean> {
  const minute = Math.floor(now / 60000);
  const id = `global:${minute}`;
  const bucket = await OtpRateBucket.findOneAndUpdate(
    { _id: id },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date((minute + 2) * 60000) },
    },
    { upsert: true, new: true },
  );
  return bucket.count <= 120;
}

/** A shared limit cannot be bypassed by forging forwarding headers. */
export async function allowAdminLogin(now = Date.now()): Promise<boolean> {
  const minute = Math.floor(now / 60000);
  const bucket = await OtpRateBucket.findOneAndUpdate(
    { _id: `admin-login:${minute}` },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date((minute + 2) * 60000) },
    },
    { upsert: true, new: true },
  );
  return bucket.count <= 10;
}

/** Limit creation of anonymous cart records across application instances. */
export async function allowGuestCartAllocation(
  now = Date.now(),
): Promise<boolean> {
  const minute = Math.floor(now / 60000);
  const bucket = await OtpRateBucket.findOneAndUpdate(
    { _id: `guest-cart:${minute}` },
    {
      $inc: { count: 1 },
      $setOnInsert: { expiresAt: new Date((minute + 2) * 60000) },
    },
    { upsert: true, new: true },
  );
  return bucket.count <= 240;
}
