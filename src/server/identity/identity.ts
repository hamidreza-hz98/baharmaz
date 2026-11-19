import "server-only";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import mongoose, { Schema } from "mongoose";

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCallback(
      password,
      salt,
      64,
      { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
const customerSchema = new Schema(
  {
    mobile: { type: String, required: true, match: /^09\d{9}$/ },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    firstName: { type: String, trim: true, maxlength: 60 },
    lastName: { type: String, trim: true, maxlength: 60 },
    passwordHash: { type: String, select: false },
    mobileVerified: { type: Boolean, default: false },
    authVersion: { type: Number, default: 0, min: 0 },
    birthdate: { type: String, default: null },
    phoneChange: { type: Schema.Types.Mixed, select: false, default: null },
  },
  { timestamps: true, autoIndex: false },
);
customerSchema.index({ mobile: 1 }, { unique: true });
const adminSchema = new Schema(
  {
    _id: {
      type: String,
      default: "primary",
      enum: ["primary"],
      immutable: true,
    },
    username: { type: String, required: true },
    name: { type: String, trim: true, maxlength: 120, default: "" },
    mobile: { type: String, default: "" },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true, autoIndex: false },
);
const sessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true },
    principalType: {
      type: String,
      enum: ["customer", "admin"],
      required: true,
    },
    principalId: { type: String, required: true },
    authVersion: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true, autoIndex: false },
);
sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const Customer =
  mongoose.models.IdentityCustomer ||
  mongoose.model("IdentityCustomer", customerSchema);
export const Admin =
  mongoose.models.IdentityAdmin || mongoose.model("IdentityAdmin", adminSchema);
export const Session =
  mongoose.models.IdentitySession ||
  mongoose.model("IdentitySession", sessionSchema);

const MAX_DAYS = 365;
export type PrincipalType = "customer" | "admin";
export function sessionDays(value: string | undefined): number {
  if (value === undefined) return 30;
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > MAX_DAYS)
    throw new Error("SESSION_DAYS must be an integer from 1 to 365.");
  return Number(value);
}
export async function hashPassword(
  password: string,
  minimumLength = 12,
): Promise<string> {
  if (
    typeof password !== "string" ||
    password.length < minimumLength ||
    Buffer.byteLength(password, "utf8") > 1024
  )
    throw new Error(
      `Password must contain at least ${minimumLength} characters and at most 1024 bytes.`,
    );
  const salt = randomBytes(16);
  const key = await scrypt(password, salt);
  return `scrypt-v1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (
    typeof password !== "string" ||
    Buffer.byteLength(password, "utf8") > 1024
  )
    return false;
  const parts = stored.split("$");
  if (
    parts.length !== 3 ||
    parts[0] !== "scrypt-v1" ||
    !/^[A-Za-z0-9_-]{22}$/.test(parts[1]) ||
    !/^[A-Za-z0-9_-]{86}$/.test(parts[2])
  )
    return false;
  const salt = Buffer.from(parts[1], "base64url");
  const expected = Buffer.from(parts[2], "base64url");
  const actual = await scrypt(password, salt);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function digest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
export async function bootstrapAdmin(
  username: string,
  password: string,
): Promise<boolean> {
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(normalized))
    throw new Error(
      "Admin username must use 3–64 ASCII letters, digits, dots, underscores or hyphens.",
    );
  const passwordHash = await hashPassword(password);
  try {
    await Admin.create({ _id: "primary", username: normalized, passwordHash });
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    )
      return false;
    throw error;
  }
}
export async function createSession(
  type: PrincipalType,
  principalId: string,
  days = sessionDays(process.env.SESSION_DAYS),
  expectedCustomer?: { mobile: string; authVersion: number },
) {
  if (type !== "admin" && type !== "customer")
    throw new Error("Invalid principal type.");
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS)
    throw new Error("Invalid session lifetime.");
  if (
    type === "admin"
      ? principalId !== "primary"
      : !mongoose.isValidObjectId(principalId)
  )
    throw new Error("Invalid principal identifier.");
  const principal =
    type === "admin"
      ? await Admin.exists({ _id: principalId })
      : await Customer.findOne({
          _id: principalId,
          mobileVerified: true,
          ...(expectedCustomer
            ? {
                mobile: expectedCustomer.mobile,
                $or: [
                  { authVersion: expectedCustomer.authVersion },
                  ...(expectedCustomer.authVersion
                    ? []
                    : [{ authVersion: { $exists: false } }]),
                ],
              }
            : {}),
        })
          .select("authVersion")
          .lean();
  if (!principal) throw new Error("Principal not found or not verified.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + days * 86400000);
  await Session.create({
    tokenHash: digest(token),
    principalType: type,
    principalId,
    authVersion:
      type === "customer"
        ? ((principal as { authVersion?: number }).authVersion ?? 0)
        : 0,
    expiresAt,
  });
  return { token, expiresAt };
}
export async function resolveSessionDetails(
  token: string | undefined,
  type: PrincipalType,
) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const session = await Session.findOne({
    tokenHash: digest(token),
    principalType: type,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!session) return null;
  const exists =
    type === "admin"
      ? await Admin.exists({ _id: session.principalId })
      : await Customer.exists({
          _id: session.principalId,
          mobileVerified: true,
          $or: [
            { authVersion: session.authVersion ?? 0 },
            ...(session.authVersion
              ? []
              : [{ authVersion: { $exists: false } }]),
          ],
        });
  return exists
    ? {
        type,
        id: session.principalId as string,
        sessionId: String(session._id),
      }
    : null;
}
export async function resolveSession(
  token: string | undefined,
  type: PrincipalType,
) {
  const result = await resolveSessionDetails(token, type);
  return result ? { type: result.type, id: result.id } : null;
}
export async function revokeSession(
  token: string | undefined,
  type: PrincipalType,
): Promise<void> {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return;
  await Session.updateOne(
    { tokenHash: digest(token), principalType: type, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}
