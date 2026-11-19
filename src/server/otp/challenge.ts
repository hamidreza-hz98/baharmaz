import "server-only";
import { createHmac, randomInt, randomBytes } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import type { SmsProvider } from "./provider.ts";
import { otpConfig } from "./provider.ts";
import {
  normalizeIranianMobile,
  normalizeDigits,
} from "../../shared/locale.ts";

const schema = new Schema(
  {
    _id: String,
    codeHash: String,
    issue: String,
    expiresAt: Date,
    lastSentAt: Date,
    windowStart: Date,
    sends: { type: Number, default: 0 },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: true },
    cleanupAt: Date,
    purpose: { type: String, default: "login" },
  },
  { autoIndex: false, versionKey: false },
);
schema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });
export const OtpChallenge =
  mongoose.models.OtpChallenge || mongoose.model("OtpChallenge", schema);
function codeDigest(
  secret: string,
  mobile: string,
  issue: string,
  code: string,
) {
  return createHmac("sha256", secret)
    .update(`${mobile}:${issue}:${code}`)
    .digest("hex");
}
/** This low-level service requires an additional network-wide rate limiter before public exposure. */
export async function issueOtp(
  rawMobile: string,
  provider: SmsProvider,
  env: NodeJS.ProcessEnv = process.env,
  purpose = "login",
): Promise<"sent" | "throttled" | "delivery_failed"> {
  const mobile = normalizeIranianMobile(rawMobile);
  const config = otpConfig(env);
  const now = new Date();
  try {
    await OtpChallenge.updateOne(
      { _id: mobile },
      { $setOnInsert: { windowStart: now, sends: 0, consumed: true } },
      { upsert: true },
    );
  } catch (error) {
    if (!(
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ))
      throw error;
  }
  await OtpChallenge.updateOne(
    { _id: mobile, windowStart: { $lte: new Date(now.getTime() - 3600000) } },
    { $set: { windowStart: now, sends: 0 } },
  );
  const developmentCode =
    env.NODE_ENV === "development" &&
    env.SMS_PROVIDER === "development" &&
    env.OTP_DEV_LOG_CODES === "true";
  const code = developmentCode
    ? "1234"
    : String(randomInt(0, 10000)).padStart(4, "0");
  const issue = randomBytes(16).toString("hex");
  const challenge = await OtpChallenge.findOneAndUpdate(
    {
      _id: mobile,
      sends: { $lt: config.maxSendsPerHour },
      $or: [
        { lastSentAt: { $exists: false } },
        {
          lastSentAt: {
            $lte: new Date(now.getTime() - config.cooldownSeconds * 1000),
          },
        },
      ],
    },
    {
      $set: {
        codeHash: codeDigest(config.secret, mobile, issue, code),
        issue,
        purpose,
        expiresAt: new Date(now.getTime() + config.expirySeconds * 1000),
        cleanupAt: new Date(now.getTime() + 2 * 3600000),
        lastSentAt: now,
        attempts: 0,
        consumed: false,
      },
      $inc: { sends: 1 },
    },
    { new: true },
  );
  if (!challenge) return "throttled";
  try {
    await provider.sendCode(mobile, code);
    return "sent";
  } catch {
    await OtpChallenge.updateOne(
      { _id: mobile, issue },
      { $set: { consumed: true } },
    );
    return "delivery_failed";
  }
}
/** Atomically counts attempts and consumes successful codes; never use the boolean as an authenticated session by itself. */
export async function consumeOtp(
  rawMobile: string,
  rawCode: string,
  env: NodeJS.ProcessEnv = process.env,
  purpose = "login",
): Promise<boolean> {
  const mobile = normalizeIranianMobile(rawMobile);
  const code = normalizeDigits(rawCode.trim());
  if (!/^\d{4}$/.test(code)) return false;
  const config = otpConfig(env);
  const now = new Date();
  const challenge = await OtpChallenge.findOneAndUpdate(
    {
      _id: mobile,
      consumed: false,
      purpose,
      expiresAt: { $gt: now },
      attempts: { $lt: config.maxAttempts },
    },
    { $inc: { attempts: 1 } },
    { new: true },
  ).lean();
  if (!challenge || !challenge.issue) return false;
  const hash = codeDigest(config.secret, mobile, challenge.issue, code);
  const result = await OtpChallenge.updateOne(
    {
      _id: mobile,
      issue: challenge.issue,
      codeHash: hash,
      consumed: false,
      expiresAt: { $gt: new Date() },
    },
    { $set: { consumed: true } },
  );
  return result.modifiedCount === 1;
}
