import "server-only";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { Customer, Admin, Session } from "../identity/identity.ts";
import {
  normalizeIranianMobile,
  parseJalaliDate,
} from "../../shared/locale.ts";
import { issueOtp, consumeOtp } from "../otp/challenge.ts";
import type { SmsProvider } from "../otp/provider.ts";

function nameValue(name: string) {
  const value = name.trim();
  if (value.length < 2 || value.length > 120)
    throw new RangeError("Invalid name.");
  return value;
}
function validId(id: string) {
  if (!mongoose.isValidObjectId(id))
    throw new RangeError("Invalid identifier.");
}
export async function getCustomerProfile(customerId: string) {
  validId(customerId);
  return Customer.findById(customerId)
    .select("name mobile birthdate mobileVerified")
    .lean();
}
export async function updateCustomerProfile(
  customerId: string,
  name: string,
  birthdate: string | null,
) {
  validId(customerId);
  const parsed = birthdate ? parseJalaliDate(birthdate) : null;
  const canonical = parsed
    ? `${parsed.year}/${String(parsed.month).padStart(2, "0")}/${String(parsed.day).padStart(2, "0")}`
    : null;
  return Customer.findByIdAndUpdate(
    customerId,
    { $set: { name: nameValue(name), birthdate: canonical } },
    { new: true, runValidators: true },
  )
    .select("name mobile birthdate mobileVerified")
    .lean();
}
export async function updateAdminProfile(
  adminId: string,
  name: string,
  username: string,
  mobile: string,
) {
  if (adminId !== "primary") throw new Error("Unauthorized.");
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,64}$/.test(normalized))
    throw new RangeError("Invalid username.");
  const phone = mobile.trim() ? normalizeIranianMobile(mobile) : "";
  return Admin.findByIdAndUpdate(
    "primary",
    { $set: { name: nameValue(name), username: normalized, mobile: phone } },
    { new: true, runValidators: true },
  )
    .select("name username mobile")
    .lean();
}
export async function listAdminSessions(
  adminId: string,
  currentSessionId: string,
) {
  if (adminId !== "primary") throw new Error("Unauthorized.");
  validId(currentSessionId);
  const sessions = await Session.find({
    principalType: "admin",
    principalId: adminId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  })
    .select("_id createdAt expiresAt")
    .sort({ createdAt: -1 })
    .lean();
  return sessions.map((session) => ({
    id: String(session._id),
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    current: String(session._id) === currentSessionId,
  }));
}
export async function revokeAdminSession(
  adminId: string,
  currentSessionId: string,
  targetSessionId: string,
) {
  if (adminId !== "primary") throw new Error("Unauthorized.");
  validId(currentSessionId);
  validId(targetSessionId);
  const result = await Session.updateOne(
    {
      _id: targetSessionId,
      principalType: "admin",
      principalId: adminId,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    },
    { $set: { revokedAt: new Date() } },
  );
  return {
    revoked: result.modifiedCount === 1,
    current: result.modifiedCount === 1 && currentSessionId === targetSessionId,
  };
}
const purpose = (id: string, step: "old" | "new") =>
  `phone-change:${id}:${step}`;
const active = (customerId: string, sessionId: string, stage: string) => ({
  _id: customerId,
  "phoneChange.sessionId": sessionId,
  "phoneChange.stage": stage,
  "phoneChange.expiresAt": { $gt: new Date() },
});
export async function startPhoneChange(
  customerId: string,
  sessionId: string,
  provider: SmsProvider,
  env: NodeJS.ProcessEnv = process.env,
) {
  validId(customerId);
  validId(sessionId);
  const customer = await Customer.findById(customerId)
    .select("mobile mobileVerified")
    .lean();
  if (!customer || !customer.mobileVerified)
    throw new Error("Verified current mobile required.");
  const id = randomBytes(16).toString("hex");
  const change = {
    id,
    sessionId,
    oldMobile: customer.mobile,
    stage: "old_sending",
    expiresAt: new Date(Date.now() + 10 * 60000),
  };
  const claimed = await Customer.updateOne(
    { _id: customerId, mobile: customer.mobile },
    { $set: { phoneChange: change } },
  );
  if (!claimed.modifiedCount) throw new Error("Could not start verification.");
  const sent = await issueOtp(
    customer.mobile,
    provider,
    env,
    purpose(id, "old"),
  );
  if (sent !== "sent") {
    await Customer.updateOne(
      { _id: customerId, "phoneChange.id": id },
      { $unset: { phoneChange: "" } },
    );
    return sent;
  }
  const activated = await Customer.updateOne(
    {
      ...active(customerId, sessionId, "old_sending"),
      "phoneChange.id": id,
    },
    { $set: { "phoneChange.stage": "old_sent" } },
  );
  return activated.modifiedCount === 1
    ? ("sent" as const)
    : ("delivery_failed" as const);
}
export async function verifyOldPhone(
  customerId: string,
  sessionId: string,
  code: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  validId(customerId);
  validId(sessionId);
  const customer = await Customer.findOne(
    active(customerId, sessionId, "old_sent"),
  )
    .select("+phoneChange mobile")
    .lean();
  const pending = customer?.phoneChange;
  if (
    !pending ||
    customer.mobile !== pending.oldMobile ||
    !(await consumeOtp(
      pending.oldMobile,
      code,
      env,
      purpose(pending.id, "old"),
    ))
  )
    return false;
  const result = await Customer.updateOne(
    {
      ...active(customerId, sessionId, "old_sent"),
      mobile: pending.oldMobile,
      "phoneChange.id": pending.id,
    },
    { $set: { "phoneChange.stage": "old_verified" } },
  );
  return result.modifiedCount === 1;
}
export async function sendNewPhoneCode(
  customerId: string,
  sessionId: string,
  rawMobile: string,
  provider: SmsProvider,
  env: NodeJS.ProcessEnv = process.env,
) {
  validId(customerId);
  validId(sessionId);
  const mobile = normalizeIranianMobile(rawMobile);
  const customer = await Customer.findOne(
    active(customerId, sessionId, "old_verified"),
  )
    .select("+phoneChange mobile")
    .lean();
  const pending = customer?.phoneChange;
  if (
    !pending ||
    customer.mobile !== pending.oldMobile ||
    mobile === pending.oldMobile
  )
    throw new Error("Phone change verification required.");
  const claimed = await Customer.updateOne(
    {
      ...active(customerId, sessionId, "old_verified"),
      mobile: pending.oldMobile,
      "phoneChange.id": pending.id,
    },
    {
      $set: {
        "phoneChange.stage": "new_sending",
        "phoneChange.newMobile": mobile,
      },
    },
  );
  if (!claimed.modifiedCount)
    throw new Error("Phone change is no longer active.");
  const sent = await issueOtp(
    mobile,
    provider,
    env,
    purpose(pending.id, "new"),
  );
  if (sent !== "sent") {
    await Customer.updateOne(
      {
        ...active(customerId, sessionId, "new_sending"),
        "phoneChange.id": pending.id,
      },
      {
        $set: { "phoneChange.stage": "old_verified" },
        $unset: { "phoneChange.newMobile": "" },
      },
    );
    return sent;
  }
  const activated = await Customer.updateOne(
    {
      ...active(customerId, sessionId, "new_sending"),
      "phoneChange.id": pending.id,
    },
    { $set: { "phoneChange.stage": "new_sent" } },
  );
  return activated.modifiedCount === 1
    ? ("sent" as const)
    : ("delivery_failed" as const);
}
export async function confirmNewPhone(
  customerId: string,
  sessionId: string,
  code: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  validId(customerId);
  validId(sessionId);
  const indexes = await Customer.collection.indexes();
  if (
    !indexes.some(
      (index) =>
        index.unique === true &&
        Object.keys(index.key).length === 1 &&
        index.key.mobile === 1,
    )
  ) {
    throw new Error("The unique customer mobile index is required.");
  }
  const customer = await Customer.findOne(
    active(customerId, sessionId, "new_sent"),
  )
    .select("+phoneChange mobile")
    .lean();
  const pending = customer?.phoneChange;
  if (
    !pending ||
    customer.mobile !== pending.oldMobile ||
    !(await consumeOtp(
      pending.newMobile,
      code,
      env,
      purpose(pending.id, "new"),
    ))
  )
    return false;
  // Unique mobile index must be installed. All proof and expiry conditions are rechecked in the same atomic customer update.
  const result = await Customer.updateOne(
    {
      ...active(customerId, sessionId, "new_sent"),
      mobile: pending.oldMobile,
      "phoneChange.id": pending.id,
      "phoneChange.newMobile": pending.newMobile,
    },
    {
      $set: { mobile: pending.newMobile, mobileVerified: true },
      $unset: { phoneChange: "" },
    },
    { runValidators: true },
  );
  return result.modifiedCount === 1;
}
