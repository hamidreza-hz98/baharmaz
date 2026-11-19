import assert from "node:assert/strict";
import mongoose from "mongoose";
import { allowOtpRequest } from "../../src/server/otp/rate-limit.ts";
import { configuredSmsProvider } from "../../src/server/otp/configured-provider.ts";
import { getDatabaseConfig } from "../../src/server/config/database.ts";
import {
  createDevelopmentSmsProvider,
  otpConfig,
} from "../../src/server/otp/provider.ts";
import {
  OtpChallenge,
  issueOtp,
  consumeOtp,
} from "../../src/server/otp/challenge.ts";
import {
  verifyCustomerOtp,
  registerVerifiedCustomer,
} from "../../src/server/otp/customer-auth.ts";
import {
  Customer,
  resolveSession,
} from "../../src/server/identity/identity.ts";
const config = getDatabaseConfig();
await mongoose.connect(config.uri, { dbName: config.dbName, autoIndex: false });
try {
  const env = {
    NODE_ENV: "test",
    OTP_SECRET: "test-secret-with-more-than-32-bytes",
    OTP_MAX_ATTEMPTS: "2",
  };
  assert.throws(() => otpConfig({}), /OTP_SECRET/);
  const fixedTime = Date.now();
  for (let i = 0; i < 120; i++)
    assert.equal(await allowOtpRequest(fixedTime), true);
  assert.equal(await allowOtpRequest(fixedTime), false);
  assert.throws(() =>
    configuredSmsProvider({
      NODE_ENV: "production",
      SMS_PROVIDER: "development",
      OTP_DEV_LOG_CODES: "true",
    }),
  );
  assert.throws(() =>
    createDevelopmentSmsProvider({ NODE_ENV: "production" }, () => {}),
  );
  let code = "";
  const fake = createDevelopmentSmsProvider(env, (_phone, value) => {
    code = value;
  });
  const phone = "09120000001";
  assert.equal(await issueOtp(phone, fake, env), "sent");
  assert.match(code, /^\d{4}$/);
  assert.equal(await issueOtp(phone, fake, env), "throttled");
  assert.equal(await consumeOtp(phone, code, env), true);
  assert.equal(await consumeOtp(phone, code, env), false);
  const failPhone = "09120000002";
  assert.equal(
    await issueOtp(
      failPhone,
      {
        async sendCode() {
          throw new Error("delivery failed");
        },
      },
      env,
    ),
    "delivery_failed",
  );
  assert.equal((await OtpChallenge.findById(failPhone).lean()).consumed, true);
  const attemptsPhone = "09120000003";
  await issueOtp(attemptsPhone, fake, env);
  const correct = code;
  const wrong = correct === "0000" ? "0001" : "0000";
  assert.equal(await consumeOtp(attemptsPhone, wrong, env), false);
  assert.equal(await consumeOtp(attemptsPhone, wrong, env), false);
  assert.equal(await consumeOtp(attemptsPhone, correct, env), false);
  const expiredPhone = "09120000004";
  await issueOtp(expiredPhone, fake, env);
  await OtpChallenge.updateOne(
    { _id: expiredPhone },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  assert.equal(await consumeOtp(expiredPhone, code, env), false);
  const racePhone = "09120000005";
  await issueOtp(racePhone, fake, env);
  const results = await Promise.all([
    consumeOtp(racePhone, code, env),
    consumeOtp(racePhone, code, env),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  const limitedPhone = "09120000008";
  const limited = { ...env, OTP_MAX_SENDS_PER_HOUR: "2" };
  assert.equal(await issueOtp(limitedPhone, fake, limited), "sent");
  await OtpChallenge.updateOne(
    { _id: limitedPhone },
    { $set: { lastSentAt: new Date(Date.now() - 120000) } },
  );
  assert.equal(await issueOtp(limitedPhone, fake, limited), "sent");
  await OtpChallenge.updateOne(
    { _id: limitedPhone },
    { $set: { lastSentAt: new Date(Date.now() - 120000) } },
  );
  assert.equal(await issueOtp(limitedPhone, fake, limited), "throttled");
  await Customer.createIndexes();
  const newPhone = "09120000006";
  await issueOtp(newPhone, fake, env);
  const registration = await verifyCustomerOtp(newPhone, code, env);
  assert.equal(registration.status, "registration");
  const session = await registerVerifiedCustomer(
    registration.token,
    "کاربر",
    "نمونه",
    "12345678",
    "12345678",
  );
  assert.ok(await resolveSession(session.token, "customer"));
  const registered = await Customer.findOne({ mobile: newPhone }).lean();
  assert.equal(registered.firstName, "کاربر");
  assert.equal(registered.lastName, "نمونه");
  assert.equal(registered.name, "کاربر نمونه");
  assert.equal(
    (await Customer.findOne({ mobile: newPhone }).lean()).mobileVerified,
    true,
  );
  await assert.rejects(
    registerVerifiedCustomer(
      registration.token,
      "کاربر",
      "نمونه",
      "a-long-test-password",
      "a-long-test-password",
    ),
  );
  const existingPhone = "09120000007";
  const customer = await Customer.create({
    mobile: existingPhone,
    name: "مشتری ثبت شده",
    mobileVerified: false,
  });
  await issueOtp(existingPhone, fake, env);
  const returning = await verifyCustomerOtp(existingPhone, code, env);
  assert.equal(returning.status, "authenticated");
  assert.equal(
    (await resolveSession(returning.session.token, "customer")).id,
    String(customer._id),
  );
  assert.equal(
    (await Customer.findById(customer._id).lean()).mobileVerified,
    true,
  );
  console.log(
    "OTP contract passed: fake delivery, failure, cooldown, attempts, expiry and single consumption.",
  );
} finally {
  await mongoose.disconnect();
}
