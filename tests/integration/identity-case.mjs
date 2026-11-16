import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import mongoose from "mongoose";
import { getDatabaseConfig } from "../../src/server/config/database.ts";
import {
  Admin,
  Customer,
  Session,
  bootstrapAdmin,
  createSession,
  resolveSession,
  revokeSession,
  hashPassword,
  verifyPassword,
  sessionDays,
} from "../../src/server/identity/identity.ts";
const config = getDatabaseConfig();
await mongoose.connect(config.uri, { dbName: config.dbName, autoIndex: false });
try {
  await Customer.createIndexes();
  await Session.createIndexes();
  const hash = await hashPassword("a-long-test-password");
  assert.equal(await verifyPassword("a-long-test-password", hash), true);
  assert.equal(await verifyPassword("incorrect", hash), false);
  assert.equal(await verifyPassword("incorrect", "garbage"), false);
  await assert.rejects(hashPassword("short"));
  assert.equal(sessionDays("365"), 365);
  assert.throws(() => sessionDays("366"));
  const outcomes = await Promise.all([
    bootstrapAdmin("admin", "a-long-test-password"),
    bootstrapAdmin("other", "another-long-password"),
  ]);
  assert.equal(outcomes.filter(Boolean).length, 1);
  assert.equal(await Admin.countDocuments(), 1);
  assert.equal(await bootstrapAdmin("admin", "different-password"), false);
  const repeated = spawnSync(
    process.execPath,
    ["--conditions=react-server", "scripts/bootstrap-admin.mjs"],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        ADMIN_BOOTSTRAP_USERNAME: "another",
        ADMIN_BOOTSTRAP_PASSWORD: "another-test-password",
      },
      timeout: 30000,
    },
  );
  assert.equal(repeated.status, 0);
  assert.match(repeated.stdout, /already exists/);
  assert.doesNotMatch(
    repeated.stdout + repeated.stderr,
    /another-test-password/,
  );
  const customer = await Customer.create({
    name: "کاربر نمونه",
    mobile: "09120000000",
    mobileVerified: true,
  });
  await assert.rejects(
    Customer.create({ name: "نمونه", mobile: "09120000000" }),
  );
  const a = await createSession("admin", "primary", 365);
  const c = await createSession("customer", String(customer._id), 1);
  assert.deepEqual(await resolveSession(a.token, "admin"), {
    type: "admin",
    id: "primary",
  });
  assert.equal(await resolveSession(a.token, "customer"), null);
  assert.equal(await resolveSession(c.token, "admin"), null);
  assert.equal(
    (await resolveSession(c.token, "customer"))?.id,
    String(customer._id),
  );
  assert.equal(await Session.exists({ tokenHash: a.token }), null);
  await revokeSession(c.token, "admin");
  assert.ok(await resolveSession(c.token, "customer"));
  await revokeSession(c.token, "customer");
  assert.equal(await resolveSession(c.token, "customer"), null);
  await Session.updateOne(
    { principalType: "admin" },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  assert.equal(await resolveSession(a.token, "admin"), null);
  await assert.rejects(createSession("admin", "other", 1));
  await Customer.updateOne(
    { _id: customer._id },
    { $set: { authVersion: 1, mobile: "09120000001", mobileVerified: true } },
  );
  await assert.rejects(
    createSession("customer", String(customer._id), 1, {
      mobile: "09120000000",
      authVersion: 0,
    }),
  );
  console.log(
    "Identity integration passed: singleton bootstrap, password hashing, role isolation, expiry and revocation.",
  );
} finally {
  await mongoose.disconnect();
}
