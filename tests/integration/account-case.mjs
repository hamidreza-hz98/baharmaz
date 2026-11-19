import assert from "node:assert/strict";
import mongoose from "mongoose";
import { getDatabaseConfig } from "../../src/server/config/database.ts";
import {
  Admin,
  Customer,
  Session,
  createSession,
  resolveSessionDetails,
  resolveSession,
} from "../../src/server/identity/identity.ts";
import { OtpChallenge, consumeOtp } from "../../src/server/otp/challenge.ts";
import { createDevelopmentSmsProvider } from "../../src/server/otp/provider.ts";
import {
  updateCustomerProfile,
  updateAdminProfile,
  listAdminSessions,
  revokeAdminSession,
  startPhoneChange,
  verifyOldPhone,
  sendNewPhoneCode,
  confirmNewPhone,
} from "../../src/server/account/account.ts";
const config = getDatabaseConfig();
await mongoose.connect(config.uri, { dbName: config.dbName, autoIndex: false });
try {
  await Customer.createIndexes();
  await Session.createIndexes();
  await Admin.create({
    _id: "primary",
    username: "admin",
    passwordHash: "unused-test-hash",
  });
  const user = await Customer.create({
    mobile: "09120000010",
    name: "کاربر نمونه",
    mobileVerified: true,
  });
  const other = await Customer.create({
    mobile: "09120000011",
    name: "کاربر دیگر",
    mobileVerified: true,
  });
  const userId = String(user._id),
    otherId = String(other._id);
  const userSession = await createSession("customer", userId);
  const detail = await resolveSessionDetails(userSession.token, "customer");
  const otherSession = await createSession("customer", otherId);
  const otherDetail = await resolveSessionDetails(
    otherSession.token,
    "customer",
  );
  assert.ok(detail && otherDetail);
  const changed = await updateCustomerProfile(
    userId,
    "نام",
    "تازه",
    "۱۳۹۹/۱۲/۳۰",
  );
  assert.equal(changed.birthdate, "1399/12/30");
  assert.equal(changed.firstName, "نام");
  assert.equal(changed.lastName, "تازه");
  assert.equal(changed.name, "نام تازه");
  await assert.rejects(
    updateCustomerProfile(userId, "نام", "تازه", "۱۴۰۰/۱۲/۳۰"),
  );
  assert.equal((await Customer.findById(otherId)).name, "کاربر دیگر");
  const devUser = await Customer.create({
    mobile: "09120000030",
    name: "آزمایش توسعه",
    mobileVerified: true,
  });
  const devSession = await createSession("customer", String(devUser._id));
  const devDetail = await resolveSessionDetails(devSession.token, "customer");
  const devEnv = {
    NODE_ENV: "development",
    SMS_PROVIDER: "development",
    OTP_DEV_LOG_CODES: "true",
    OTP_SECRET: "account-test-secret-at-least-32-bytes",
  };
  let developmentCode = "";
  const devProvider = createDevelopmentSmsProvider(devEnv, (_phone, value) => {
    developmentCode = value;
  });
  assert.equal(
    await startPhoneChange(
      String(devUser._id),
      devDetail.sessionId,
      devProvider,
      devEnv,
    ),
    "sent",
  );
  assert.equal(developmentCode, "1234");
  assert.equal(
    await verifyOldPhone(
      String(devUser._id),
      devDetail.sessionId,
      "1234",
      devEnv,
    ),
    true,
  );
  assert.equal(
    await sendNewPhoneCode(
      String(devUser._id),
      devDetail.sessionId,
      "09120000031",
      devProvider,
      devEnv,
    ),
    "sent",
  );
  assert.equal(developmentCode, "1234");
  assert.equal(
    await confirmNewPhone(
      String(devUser._id),
      devDetail.sessionId,
      "1234",
      devEnv,
    ),
    true,
  );
  const env = {
    NODE_ENV: "test",
    OTP_SECRET: "account-test-secret-at-least-32-bytes",
  };
  let code = "";
  const fake = createDevelopmentSmsProvider(env, (_phone, value) => {
    code = value;
  });
  assert.equal(
    await startPhoneChange(userId, detail.sessionId, fake, env),
    "sent",
  );
  const oldCode = code;
  assert.equal(await consumeOtp(user.mobile, oldCode, env), false); // login cannot consume change proof
  assert.equal(
    await verifyOldPhone(userId, otherDetail.sessionId, oldCode, env),
    false,
  );
  assert.equal(
    await verifyOldPhone(userId, detail.sessionId, oldCode, env),
    true,
  );
  assert.equal((await Customer.findById(userId)).mobile, user.mobile);
  await assert.rejects(
    sendNewPhoneCode(userId, otherDetail.sessionId, "09120000012", fake, env),
  );
  assert.equal(
    await sendNewPhoneCode(userId, detail.sessionId, "09120000012", fake, env),
    "sent",
  );
  const newCode = code;
  assert.equal(
    await confirmNewPhone(userId, otherDetail.sessionId, newCode, env),
    false,
  );
  assert.equal((await Customer.findById(userId)).mobile, user.mobile);
  await Customer.updateOne(
    { _id: userId },
    { $set: { "phoneChange.expiresAt": new Date(Date.now() - 1000) } },
  );
  assert.equal(
    await confirmNewPhone(userId, detail.sessionId, newCode, env),
    false,
  );
  assert.equal((await Customer.findById(userId)).mobile, user.mobile);
  await OtpChallenge.deleteMany({});
  assert.equal(
    await startPhoneChange(userId, detail.sessionId, fake, env),
    "sent",
  );
  assert.equal(await verifyOldPhone(userId, detail.sessionId, code, env), true);
  assert.equal(
    await sendNewPhoneCode(userId, detail.sessionId, "09120000012", fake, env),
    "sent",
  );
  assert.equal(
    await confirmNewPhone(userId, detail.sessionId, code, env),
    true,
  );
  assert.equal((await Customer.findById(userId)).mobile, "09120000012");
  assert.equal(
    await confirmNewPhone(userId, detail.sessionId, code, env),
    false,
  );
  await OtpChallenge.deleteMany({});
  assert.equal(
    await startPhoneChange(userId, detail.sessionId, fake, env),
    "sent",
  );
  assert.equal(await verifyOldPhone(userId, detail.sessionId, code, env), true);
  assert.equal(
    await sendNewPhoneCode(userId, detail.sessionId, other.mobile, fake, env),
    "sent",
  );
  await assert.rejects(confirmNewPhone(userId, detail.sessionId, code, env));
  assert.equal((await Customer.findById(userId)).mobile, "09120000012");
  const a = await createSession("admin", "primary"),
    b = await createSession("admin", "primary");
  const da = await resolveSessionDetails(a.token, "admin"),
    db = await resolveSessionDetails(b.token, "admin");
  assert.ok(da && db);
  const admin = await updateAdminProfile(
    "primary",
    "مدیر نمونه",
    "NEW.USER",
    "۰۹۱۲۰۰۰۰۰۰۰",
  );
  assert.equal(admin.username, "new.user");
  assert.equal(admin.mobile, "09120000000");
  assert.equal(
    (await listAdminSessions("primary", da.sessionId)).filter(
      (item) => item.current,
    ).length,
    1,
  );
  assert.equal(
    (await revokeAdminSession("primary", da.sessionId, otherDetail.sessionId))
      .revoked,
    false,
  );
  assert.deepEqual(
    await revokeAdminSession("primary", da.sessionId, db.sessionId),
    { revoked: true, current: false },
  );
  assert.equal(await resolveSession(b.token, "admin"), null);
  assert.deepEqual(
    await revokeAdminSession("primary", da.sessionId, da.sessionId),
    { revoked: true, current: true },
  );
  assert.equal(await resolveSession(a.token, "admin"), null);
  console.log(
    "Account integration passed: profile, phone verification, ownership and admin session revocation.",
  );
} finally {
  await mongoose.disconnect();
}
