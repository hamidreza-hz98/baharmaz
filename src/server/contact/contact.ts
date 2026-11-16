import "server-only";
import { createHmac } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import { normalizeIranianMobile } from "../../shared/locale.ts";
const submissionSchema = new Schema(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    message: { type: String, required: true },
  },
  { timestamps: true, versionKey: false, autoIndex: false },
);
submissionSchema.index({ createdAt: -1, _id: -1 });
const bucketSchema = new Schema(
  { _id: String, count: Number, expiresAt: Date },
  { versionKey: false, autoIndex: false },
);
bucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const ContactSubmission =
  mongoose.models.ContactSubmission ||
  mongoose.model("ContactSubmission", submissionSchema);
export const ContactBucket =
  mongoose.models.ContactBucket ||
  mongoose.model("ContactBucket", bucketSchema);
export class ContactThrottled extends Error {}
export function validateSubmission(input: Record<string, unknown>) {
  if (
    Object.keys(input).some((k) => !["name", "mobile", "message"].includes(k))
  )
    throw new RangeError("Unknown field");
  function value(input: unknown, min: number, max: number) {
    if (typeof input !== "string") throw new RangeError("Invalid text");
    const v = input.trim().normalize("NFKC");
    if (
      v.length < min ||
      v.length > max ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)
    )
      throw new RangeError("Invalid text");
    return v;
  }
  return {
    name: value(input.name, 2, 120),
    mobile: normalizeIranianMobile(value(input.mobile, 10, 30)),
    message: value(input.message, 5, 4000),
  };
}
export async function submitContact(
  input: Record<string, unknown>,
  now = Date.now(),
) {
  const content = validateSubmission(input);
  const secret = process.env.CONTACT_RATE_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32)
    throw new Error("CONTACT_RATE_SECRET must contain at least 32 bytes.");
  const indexes = await ContactBucket.collection.indexes().catch(() => []);
  if (
    !indexes.some(
      (index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0,
    )
  )
    throw new Error("Contact rate expiry index missing.");
  const window = Math.floor(now / 3600000);
  const hash = createHmac("sha256", secret)
    .update(content.mobile)
    .digest("hex");
  const consume = async (id: string, max: number) => {
    const bucket = await ContactBucket.findOneAndUpdate(
      { _id: id },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((window + 2) * 3600000) },
      },
      { upsert: true, new: true },
    );
    return bucket.count <= max;
  };
  if (!(await consume(`global:${window}`, 120))) throw new ContactThrottled();
  if (!(await consume(`mobile:${window}:${hash}`, 3)))
    throw new ContactThrottled();
  await ContactSubmission.create(content);
}
