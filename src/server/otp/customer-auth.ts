import "server-only";
import { createHash, randomBytes } from "node:crypto";
import mongoose, { Schema } from "mongoose";
import { normalizeIranianMobile } from "../../shared/locale.ts";
import { Customer, createSession, hashPassword } from "../identity/identity.ts";
import { consumeOtp } from "./challenge.ts";
import { validateCustomerName } from "../../shared/customer-name.ts";

const ticketSchema = new Schema(
  {
    _id: String,
    mobile: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false, autoIndex: false },
);
ticketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RegistrationTicket =
  mongoose.models.RegistrationTicket ||
  mongoose.model("RegistrationTicket", ticketSchema);
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** Only call after applying request rate limits and origin protection. */
export async function verifyCustomerOtp(
  rawMobile: string,
  code: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  const mobile = normalizeIranianMobile(rawMobile);
  if (!(await consumeOtp(mobile, code, env)))
    return { status: "invalid" } as const;
  const existing = await Customer.findOneAndUpdate(
    { mobile },
    { $set: { mobileVerified: true } },
    { new: true },
  );
  if (existing)
    return {
      status: "authenticated",
      session: await createSession(
        "customer",
        String(existing._id),
        undefined,
        { mobile, authVersion: existing.authVersion ?? 0 },
      ),
    } as const;
  const token = randomBytes(32).toString("base64url");
  await RegistrationTicket.create({
    _id: digest(token),
    mobile,
    expiresAt: new Date(Date.now() + 10 * 60000),
  });
  return { status: "registration", token } as const;
}

/** Ticket is a short-lived bearer proof of successful OTP; atomically consume it once. */
export async function registerVerifiedCustomer(
  token: string,
  firstName: string,
  lastName: string,
  password: string,
  confirmation: string,
) {
  const names = validateCustomerName(firstName, lastName);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || password !== confirmation)
    throw new Error("Invalid registration details.");
  const passwordHash = await hashPassword(password, 8);
  const ticket = await RegistrationTicket.findOneAndDelete({
    _id: digest(token),
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!ticket) throw new Error("Registration proof is invalid or expired.");
  // Existing admin-created accounts retain their name and password; unique mobile index is required.
  const customer = await Customer.findOneAndUpdate(
    { mobile: ticket.mobile },
    {
      $setOnInsert: { ...names, passwordHash },
      $set: { mobileVerified: true },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return createSession("customer", String(customer._id), undefined, {
    mobile: ticket.mobile,
    authVersion: customer.authVersion ?? 0,
  });
}
