import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, realpath, rm, readFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createHmac, createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import sharp from "sharp";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function port() {
  const server = net.createServer();
  await new Promise((resolve, reject) =>
    server.once("error", reject).listen(0, "127.0.0.1", resolve),
  );
  const value = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return value;
}
async function waitFor(fn, label, timeout = 45000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    try {
      if (await fn()) return;
    } catch {
      /* retry until deadline */
    }
    await sleep(500);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await Promise.race([exited, sleep(10000)]);
  if (child.exitCode === null && child.signalCode === null)
    throw new Error("Child process did not stop; temporary data retained.");
}
const tempRoot = await realpath(os.tmpdir());
const temp = await mkdtemp(path.join(tempRoot, "lamsechi-mongo-test-"));
let db, app;
let safeToRemove = false;
try {
  const mongoPort = await port();
  const webPort = await port();
  const uri = `mongodb://127.0.0.1:${mongoPort}`;
  const startMongo = () =>
    spawn(
      process.env.MONGOD_BINARY || "mongod",
      ["--dbpath", temp, "--bind_ip", "127.0.0.1", "--port", String(mongoPort)],
      { stdio: "ignore" },
    );
  db = startMongo();
  await waitFor(async () => {
    const socket = net.connect(mongoPort, "127.0.0.1");
    return await new Promise((resolve) => {
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
  }, "isolated MongoDB");
  const identity = spawnSync(
    process.execPath,
    ["--conditions=react-server", "tests/integration/identity-case.mjs"],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        MONGODB_TEST_URI: uri,
        MONGODB_TEST_DB_NAME: "lamsechi_test_identity",
      },
      encoding: "utf8",
      timeout: 60000,
    },
  );
  if (identity.status !== 0)
    throw new Error(
      `Identity test failed: ${identity.stdout}\n${identity.stderr}`,
    );
  console.log(identity.stdout.trim());
  const otp = spawnSync(
    process.execPath,
    ["--conditions=react-server", "tests/integration/otp-case.mjs"],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        MONGODB_TEST_URI: uri,
        MONGODB_TEST_DB_NAME: "lamsechi_test_otp",
      },
      encoding: "utf8",
      timeout: 60000,
    },
  );
  if (otp.status !== 0)
    throw new Error(`OTP test failed: ${otp.stdout}\n${otp.stderr}`);
  console.log(otp.stdout.trim());
  const account = spawnSync(
    process.execPath,
    ["--conditions=react-server", "tests/integration/account-case.mjs"],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        MONGODB_TEST_URI: uri,
        MONGODB_TEST_DB_NAME: "lamsechi_test_account",
      },
      encoding: "utf8",
      timeout: 60000,
    },
  );
  if (account.status !== 0)
    throw new Error(
      `Account test failed: ${account.stdout}\n${account.stderr}`,
    );
  console.log(account.stdout.trim());
  const media = spawnSync(
    process.execPath,
    ["--conditions=react-server", "tests/integration/media-case.mjs"],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        MONGODB_TEST_URI: uri,
        MONGODB_TEST_DB_NAME: "lamsechi_test_media",
      },
      encoding: "utf8",
      timeout: 60000,
    },
  );
  if (media.status !== 0)
    throw new Error(`Media test failed: ${media.stdout}\n${media.stderr}`);
  console.log(media.stdout.trim());
  const catalog = spawnSync(
    process.execPath,
    ["--conditions=react-server", "tests/integration/catalog-case.mjs"],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        MONGODB_TEST_URI: uri,
        MONGODB_TEST_DB_NAME: "lamsechi_test_catalog",
      },
      encoding: "utf8",
      timeout: 60000,
    },
  );
  if (catalog.status !== 0)
    throw new Error(
      `Catalog test failed: ${catalog.stdout}\n${catalog.stderr}`,
    );
  console.log(catalog.stdout.trim());
  const product = spawnSync(
    process.execPath,
    ["--conditions=react-server", "tests/integration/product-case.mjs"],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        MONGODB_TEST_URI: uri,
        MONGODB_TEST_DB_NAME: "lamsechi_test_product",
      },
      encoding: "utf8",
      timeout: 60000,
    },
  );
  if (product.status !== 0)
    throw new Error(
      `Product test failed: ${product.stdout}\n${product.stderr}`,
    );
  console.log(product.stdout.trim());
  app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(webPort),
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "development",
        MONGODB_URI: uri,
        MONGODB_SERVER_SELECTION_TIMEOUT_MS: "500",
        APP_ORIGIN: `http://127.0.0.1:${webPort}`,
        OTP_SECRET: "isolated-test-secret-with-at-least-32-bytes",
        CONTACT_RATE_SECRET: "isolated-contact-secret-with-at-least-32-bytes",
        SMS_PROVIDER: "development",
        OTP_DEV_LOG_CODES: "true",
      },
      stdio: "ignore",
    },
  );
  const endpoint = `http://127.0.0.1:${webPort}/api/health`;
  await waitFor(
    async () => (await fetch(`${endpoint}/ready`)).status === 200,
    "application readiness",
  );
  assert.equal((await fetch(`${endpoint}/live`)).status, 200);
  const authUrl = `http://127.0.0.1:${webPort}/api/auth/otp`;
  const origin = `http://127.0.0.1:${webPort}`;
  const post = (body, cookie, requestOrigin = origin) =>
    fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: requestOrigin,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await post(
        { action: "send", mobile: "09120000123" },
        undefined,
        "https://untrusted.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (await post({ action: "send", mobile: "09120000123" })).status,
    200,
  );
  const authDb = await mongoose
    .createConnection(uri, {
      dbName: "lamsechi",
      serverSelectionTimeoutMS: 1000,
    })
    .asPromise();
  await authDb.db
    .collection("identitycustomers")
    .createIndex({ mobile: 1 }, { unique: true });
  const challenge = await authDb.db
    .collection("otpchallenges")
    .findOne({ _id: "09120000123" });
  assert.ok(challenge);
  let otpCode;
  for (let i = 0; i < 10000; i++) {
    const candidate = String(i).padStart(4, "0");
    const hash = createHmac(
      "sha256",
      "isolated-test-secret-with-at-least-32-bytes",
    )
      .update(`09120000123:${challenge.issue}:${candidate}`)
      .digest("hex");
    if (hash === challenge.codeHash) {
      otpCode = candidate;
      break;
    }
  }
  assert.ok(otpCode);
  const verified = await post({
    action: "verify",
    mobile: "09120000123",
    code: otpCode,
  });
  assert.equal(verified.status, 200);
  assert.equal((await verified.json()).next, "registration");
  const ticket = verified.headers.get("set-cookie");
  assert.match(ticket, /HttpOnly/i);
  const registered = await post(
    {
      action: "register",
      firstName: "کاربر",
      lastName: "نمونه",
      password: "a-long-test-password",
      confirmation: "a-long-test-password",
    },
    ticket.split(";")[0],
  );
  assert.equal(registered.status, 200);
  assert.match(
    registered.headers.get("set-cookie"),
    /lamsechi_customer_session/,
  );
  const customerCookie = registered.headers
    .get("set-cookie")
    .match(/lamsechi_customer_session=[A-Za-z0-9_-]+/)[0];
  const accountUrl = `${origin}/api/account`;
  assert.equal((await fetch(accountUrl)).status, 401);
  assert.equal(
    (
      await fetch(`${origin}/api/admin/account`, {
        headers: { cookie: customerCookie },
      })
    ).status,
    401,
  );
  const updateProfile = (cookie, body, requestOrigin = origin) =>
    fetch(accountUrl, {
      method: "POST",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await updateProfile(
        customerCookie,
        {
          action: "profile",
          firstName: "نام",
          lastName: "جدید",
          birthdate: "۱۳۹۹/۱۲/۳۰",
        },
        "https://untrusted.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await updateProfile(customerCookie, {
        action: "profile",
        firstName: "نام",
        lastName: "جدید",
        birthdate: "۱۳۹۹/۱۲/۳۰",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await (
        await fetch(accountUrl, { headers: { cookie: customerCookie } })
      ).json()
    ).profile.birthdate,
    "1399/12/30",
  );
  await authDb.db
    .collection("otpchallenges")
    .updateOne(
      { _id: "09120000123" },
      { $set: { lastSentAt: new Date(Date.now() - 120000) } },
    );
  const getCode = async (mobile) => {
    const challenge = await authDb.db
      .collection("otpchallenges")
      .findOne({ _id: mobile });
    for (let i = 0; i < 10000; i++) {
      const value = String(i).padStart(4, "0");
      const hash = createHmac(
        "sha256",
        "isolated-test-secret-with-at-least-32-bytes",
      )
        .update(`${mobile}:${challenge.issue}:${value}`)
        .digest("hex");
      if (hash === challenge.codeHash) return value;
    }
    throw new Error("Test code not found.");
  };
  assert.equal(
    (await updateProfile(customerCookie, { action: "start" })).status,
    200,
  );
  assert.equal(
    (
      await updateProfile(customerCookie, {
        action: "verify-old",
        code: await getCode("09120000123"),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await updateProfile(customerCookie, {
        action: "send-new",
        mobile: "09120000124",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await updateProfile(customerCookie, {
        action: "verify-new",
        code: await getCode("09120000124"),
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await (
        await fetch(accountUrl, { headers: { cookie: customerCookie } })
      ).json()
    ).profile.mobile,
    "09120000124",
  );
  await authDb.db.collection("identityadmins").insertOne({
    _id: "primary",
    username: "admin",
    passwordHash:
      "scrypt-v1$KioqKioqKioqKioqKioqKg$gcpjlIzYhKjDtV7AcF0zOsZM3isrhSy3IO1NM-SwNHPwMxj1jb2X0cstFULPcde5c5rMilM6IJyyRaY0GqtLnA",
    name: "مدیر نمونه",
  });
  const adminToken = randomBytes(32).toString("base64url");
  const adminSession = await authDb.db
    .collection("identitysessions")
    .insertOne({
      tokenHash: createHash("sha256").update(adminToken).digest("hex"),
      principalType: "admin",
      principalId: "primary",
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: null,
      createdAt: new Date(),
    });
  const adminCookie = `lamsechi_admin_session=${adminToken}`;
  const adminUrl = `${origin}/api/admin/account`;
  const login = (username, password, requestOrigin = origin) =>
    fetch(`${origin}/api/admin/login`, {
      method: "POST",
      headers: { origin: requestOrigin, "content-type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  assert.equal((await fetch(adminUrl)).status, 401);
  assert.equal(
    (await fetch(adminUrl, { headers: { cookie: customerCookie } })).status,
    401,
  );
  const deniedHub = await fetch(`${origin}/admin`, {
    headers: { cookie: customerCookie },
    redirect: "manual",
  });
  assert.match(
    (deniedHub.headers.get("location") || "") + (await deniedHub.text()),
    /\/admin\/login/,
  );
  assert.equal(
    (await login("admin", "dummy-password-never-valid", "https://evil.example"))
      .status,
    403,
  );
  assert.equal(
    (await login("wrong", "dummy-password-never-valid")).status,
    401,
  );
  assert.equal((await login("admin", "wrong-password")).status, 401);
  const loggedIn = await login("ADMIN", "dummy-password-never-valid");
  assert.equal(loggedIn.status, 200);
  const loginCookie = loggedIn.headers.get("set-cookie").split(";")[0];
  assert.match(loggedIn.headers.get("set-cookie"), /HttpOnly/i);
  assert.equal(
    (await fetch(adminUrl, { headers: { cookie: loginCookie } })).status,
    200,
  );
  assert.equal(
    (
      await fetch(`${origin}/api/admin/logout`, {
        method: "POST",
        headers: {
          cookie: loginCookie,
          origin,
          "content-type": "application/json",
        },
        body: "{}",
      })
    ).status,
    200,
  );
  assert.equal(
    (await fetch(adminUrl, { headers: { cookie: loginCookie } })).status,
    401,
  );
  await authDb.db
    .collection("otpratebuckets")
    .updateOne(
      { _id: `admin-login:${Math.floor(Date.now() / 60000)}` },
      { $set: { count: 10, expiresAt: new Date(Date.now() + 120000) } },
      { upsert: true },
    );
  assert.equal(
    (await login("admin", "dummy-password-never-valid")).status,
    429,
  );
  assert.equal(
    (await fetch(accountUrl, { headers: { cookie: adminCookie } })).status,
    401,
  );
  assert.equal(
    (await fetch(adminUrl, { headers: { cookie: adminCookie } })).status,
    200,
  );
  const revoke = await fetch(adminUrl, {
    method: "POST",
    headers: {
      cookie: adminCookie,
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      action: "revoke",
      sessionId: String(adminSession.insertedId),
    }),
  });
  assert.equal(revoke.status, 200);
  assert.equal((await revoke.json()).current, true);
  assert.match(revoke.headers.get("set-cookie"), /lamsechi_admin_session=/);
  assert.equal(
    (await fetch(adminUrl, { headers: { cookie: adminCookie } })).status,
    401,
  );
  assert.equal(
    (await post({ action: "verify", mobile: "09120000123", code: otpCode }))
      .status,
    400,
  );
  const mediaToken = randomBytes(32).toString("base64url");
  await authDb.db.collection("identitysessions").insertOne({
    tokenHash: createHash("sha256").update(mediaToken).digest("hex"),
    principalType: "admin",
    principalId: "primary",
    expiresAt: new Date(Date.now() + 300000),
    revokedAt: null,
    createdAt: new Date(),
  });
  const mediaCookie = `lamsechi_admin_session=${mediaToken}`;
  for (const route of [
    "/api/admin/account",
    "/api/admin/catalog/categories",
    "/api/admin/contact-submissions",
    "/api/admin/content",
    "/api/admin/customers",
    "/api/admin/dashboard?section=orders",
    "/api/admin/delivery",
    "/api/admin/manual-order?customer=000000000000000000000000",
    "/api/admin/media",
    "/api/admin/media/000000000000000000000000",
    "/api/admin/orders",
    "/api/admin/products",
  ]) {
    assert.equal(
      (await fetch(`${origin}${route}`)).status,
      401,
      `anonymous ${route}`,
    );
    assert.equal(
      (
        await fetch(`${origin}${route}`, {
          headers: { cookie: customerCookie },
        })
      ).status,
      401,
      `customer ${route}`,
    );
  }
  const otherCustomer = await authDb.db
    .collection("identitycustomers")
    .insertOne({
      name: "مشتری دوم",
      mobile: "09120000888",
      mobileVerified: true,
    });
  const otherToken = randomBytes(32).toString("base64url");
  await authDb.db.collection("identitysessions").insertOne({
    tokenHash: createHash("sha256").update(otherToken).digest("hex"),
    principalType: "customer",
    principalId: String(otherCustomer.insertedId),
    expiresAt: new Date(Date.now() + 300000),
    revokedAt: null,
  });
  const otherCookie = `lamsechi_customer_session=${otherToken}`;
  const addressUrl = `${origin}/api/addresses`;
  const addressPost = (cookie, body, requestOrigin = origin) =>
    fetch(addressUrl, {
      method: "POST",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const addressPayload = {
    label: "خانه",
    postalCode: "۱۲۳۴۵۶۷۸۹۰",
    recipient: "گیرنده نمونه",
    mobile: "۰۹۱۲۳۴۵۶۷۸۹",
    address: "تهران خیابان نمونه پلاک ۱۲",
    coordinates: { lat: 35.71, lng: 51.42 },
  };
  assert.equal((await fetch(addressUrl)).status, 401);
  assert.equal(
    (await fetch(addressUrl, { headers: { cookie: mediaCookie } })).status,
    401,
  );
  assert.equal(
    (
      await addressPost(
        customerCookie,
        { action: "create", address: addressPayload },
        "https://untrusted.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await addressPost(customerCookie, {
        action: "create",
        address: { ...addressPayload, coordinates: { lat: 91, lng: 0 } },
      })
    ).status,
    400,
  );
  const addressCreated = await addressPost(customerCookie, {
    action: "create",
    address: addressPayload,
  });
  assert.equal(addressCreated.status, 201);
  const savedAddress = (await addressCreated.json()).item;
  assert.equal(savedAddress.postalCode, "1234567890");
  assert.deepEqual(savedAddress.coordinates, { lat: 35.71, lng: 51.42 });
  const checkoutWithoutSession = await fetch(`${origin}/checkout/address`, {
    redirect: "manual",
  });
  assert.ok([200, 307, 308].includes(checkoutWithoutSession.status));
  assert.doesNotMatch(
    await checkoutWithoutSession.text(),
    /تهران خیابان نمونه پلاک ۱۲/,
  );
  const manualResponse = await addressPost(customerCookie, {
    action: "create",
    address: { ...addressPayload, postalCode: "", coordinates: null },
  });
  assert.equal(manualResponse.status, 201);
  const manualAddress = (await manualResponse.json()).item;
  assert.equal(manualAddress.coordinates, null);
  assert.equal(
    (
      await addressPost(customerCookie, {
        action: "delete",
        id: manualAddress.id,
        revision: manualAddress.revision,
      })
    ).status,
    200,
  );
  assert.deepEqual(
    (
      await (
        await fetch(addressUrl, { headers: { cookie: otherCookie } })
      ).json()
    ).items,
    [],
  );
  assert.equal(
    (
      await addressPost(otherCookie, {
        action: "update",
        id: savedAddress.id,
        revision: 0,
        address: addressPayload,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await addressPost(otherCookie, {
        action: "delete",
        id: savedAddress.id,
        revision: 0,
      })
    ).status,
    404,
  );
  const addressEdited = await addressPost(customerCookie, {
    action: "update",
    id: savedAddress.id,
    revision: 0,
    address: {
      ...addressPayload,
      address: "نشانی ویرایش شده دستی",
      coordinates: { lat: 35.72, lng: 51.43 },
    },
  });
  assert.equal(addressEdited.status, 200);
  assert.deepEqual((await addressEdited.json()).item.coordinates, {
    lat: 35.72,
    lng: 51.43,
  });
  assert.equal(
    (
      await addressPost(customerCookie, {
        action: "delete",
        id: savedAddress.id,
        revision: 0,
      })
    ).status,
    409,
  );
  assert.equal(
    (await fetch(`${addressUrl}/map`, { headers: { cookie: customerCookie } }))
      .status,
    200,
  );
  assert.equal(
    (
      await (
        await fetch(`${addressUrl}/map`, {
          headers: { cookie: customerCookie },
        })
      ).json()
    ).map.enabled,
    false,
  );
  assert.equal(
    (
      await fetch(`${addressUrl}/reverse`, {
        method: "POST",
        headers: {
          cookie: customerCookie,
          origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({ lat: 35, lng: 51 }),
      })
    ).status,
    503,
  );
  const mediaUrl = `${origin}/api/admin/media`;
  const adminPage = await fetch(`${origin}/admin/media`, {
    headers: { cookie: mediaCookie },
    redirect: "manual",
  });
  assert.equal(adminPage.status, 200);
  assert.match(await adminPage.text(), /کتابخانه رسانه/);
  const unauthorizedPage = await fetch(`${origin}/admin/media`, {
    headers: { cookie: customerCookie },
    redirect: "manual",
  });
  assert.ok([200, 307].includes(unauthorizedPage.status));
  const unauthorizedHtml = await unauthorizedPage.text();
  assert.doesNotMatch(unauthorizedHtml, /کتابخانه رسانه/);
  if (unauthorizedPage.status === 200)
    assert.match(unauthorizedHtml, /NEXT_REDIRECT|http-equiv="refresh"/i);
  assert.equal(
    (
      await fetch(`${origin}/admin/media/upload`, {
        headers: { cookie: mediaCookie },
        redirect: "manual",
      })
    ).status,
    200,
  );
  const png = await sharp({
    create: { width: 32, height: 24, channels: 3, background: "#884433" },
  })
    .png()
    .toBuffer();
  const upload = (cookie, requestOrigin = origin) =>
    fetch(mediaUrl, {
      method: "POST",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "image/png",
        "x-file-name": "test.png",
      },
      body: png,
    });
  assert.equal((await upload(customerCookie)).status, 401);
  assert.equal(
    (await upload(mediaCookie, "https://untrusted.invalid")).status,
    403,
  );
  const uploaded = await upload(mediaCookie);
  assert.equal(uploaded.status, 201);
  const savedMedia = (await uploaded.json()).media;
  assert.equal((await fetch(mediaUrl)).status, 401);
  assert.equal(
    (await fetch(mediaUrl, { headers: { cookie: customerCookie } })).status,
    401,
  );
  const mediaReadUrl = `${mediaUrl}/${savedMedia.id}`;
  assert.equal(
    (
      await fetch(mediaReadUrl, {
        method: "DELETE",
        headers: { cookie: mediaCookie, origin },
      })
    ).status,
    405,
  );
  assert.equal((await fetch(mediaReadUrl)).status, 401);
  assert.equal(
    (await fetch(mediaReadUrl, { headers: { cookie: customerCookie } })).status,
    401,
  );
  const downloaded = await fetch(mediaReadUrl, {
    headers: { cookie: mediaCookie },
  });
  assert.equal(downloaded.status, 200);
  assert.equal(downloaded.headers.get("content-type"), "image/webp");
  assert.equal(downloaded.headers.get("cache-control"), "private, no-store");
  const mediaBytes = Buffer.from(await downloaded.arrayBuffer());
  assert.equal((await sharp(mediaBytes).metadata()).format, "webp");
  const ranged = await fetch(mediaReadUrl, {
    headers: { cookie: mediaCookie, range: "bytes=0-11" },
  });
  assert.equal(ranged.status, 206);
  assert.deepEqual(
    Buffer.from(await ranged.arrayBuffer()),
    mediaBytes.subarray(0, 12),
  );
  assert.equal(
    (
      await fetch(mediaReadUrl, {
        headers: { cookie: mediaCookie, range: "bytes=999999-" },
      })
    ).status,
    416,
  );
  const malformed = await fetch(mediaUrl, {
    method: "POST",
    headers: {
      cookie: mediaCookie,
      origin,
      "content-type": "image/png",
      "x-file-name": "broken.png",
    },
    body: Buffer.from("not an image"),
  });
  assert.equal(malformed.status, 400);
  const mp4Bytes = await readFile("tests/fixtures/media/sample.mp4");
  const videoUpload = await fetch(mediaUrl, {
    method: "POST",
    headers: {
      cookie: mediaCookie,
      origin,
      "content-type": "video/mp4",
      "x-file-name": "sample.mp4",
    },
    body: mp4Bytes,
  });
  assert.equal(videoUpload.status, 201);
  const imageList = await fetch(`${mediaUrl}?kind=image`, {
    headers: { cookie: mediaCookie },
  });
  assert.equal(imageList.status, 200);
  const images = await imageList.json();
  assert.equal(images.total, 1);
  assert.equal(images.items[0].id, savedMedia.id);
  const videoList = await (
    await fetch(`${mediaUrl}?kind=video`, { headers: { cookie: mediaCookie } })
  ).json();
  assert.equal(videoList.total, 1);
  assert.equal(videoList.items[0].kind, "video");
  const noResults = await (
    await fetch(`${mediaUrl}?q=%2E%2A`, { headers: { cookie: mediaCookie } })
  ).json();
  assert.equal(noResults.total, 0);
  const literalDot = await (
    await fetch(`${mediaUrl}?q=%2E`, { headers: { cookie: mediaCookie } })
  ).json();
  assert.equal(literalDot.total, 2);
  const literalBracket = await fetch(`${mediaUrl}?q=%5B`, {
    headers: { cookie: mediaCookie },
  });
  assert.equal(literalBracket.status, 200);
  assert.equal((await literalBracket.json()).total, 0);
  const literalParen = await fetch(`${mediaUrl}?q=%28`, {
    headers: { cookie: mediaCookie },
  });
  assert.equal(literalParen.status, 200);
  assert.equal((await literalParen.json()).total, 0);
  assert.equal(
    (
      await fetch(`${mediaUrl}?kind=other`, {
        headers: { cookie: mediaCookie },
      })
    ).status,
    400,
  );
  const videoReadUrl = `${mediaUrl}/${(await videoUpload.json()).media.id}`;
  const videoResponse = await fetch(videoReadUrl, {
    headers: { cookie: mediaCookie },
  });
  assert.equal(videoResponse.headers.get("content-type"), "video/mp4");
  assert.deepEqual(Buffer.from(await videoResponse.arrayBuffer()), mp4Bytes);
  await authDb.db
    .collection("categories")
    .createIndex({ slug: 1 }, { unique: true });
  await authDb.db
    .collection("ingredients")
    .createIndex({ normalizedName: 1 }, { unique: true });
  const categoriesUrl = `${origin}/api/admin/catalog/categories`;
  const ingredientsUrl = `${origin}/api/admin/catalog/ingredients`;
  const categoriesPage = await fetch(`${origin}/admin/categories`, {
    headers: { cookie: mediaCookie },
    redirect: "manual",
  });
  assert.equal(categoriesPage.status, 200);
  assert.match(await categoriesPage.text(), /دسته‌بندی‌ها/);
  const deniedCatalogPage = await fetch(`${origin}/admin/ingredients`, {
    headers: { cookie: customerCookie },
    redirect: "manual",
  });
  const deniedCatalogHtml = await deniedCatalogPage.text();
  assert.ok([200, 307].includes(deniedCatalogPage.status));
  assert.doesNotMatch(deniedCatalogHtml, /افزودن ماده اولیه/);
  const catalogPost = (url, cookie, data, requestOrigin = origin) =>
    fetch(url, {
      method: "POST",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify(data),
    });
  assert.equal((await fetch(categoriesUrl)).status, 401);
  assert.equal(
    (await fetch(ingredientsUrl, { headers: { cookie: customerCookie } }))
      .status,
    401,
  );
  assert.equal(
    (await fetch(categoriesUrl, { headers: { cookie: customerCookie } }))
      .status,
    401,
  );
  assert.equal(
    (
      await catalogPost(categoriesUrl, customerCookie, {
        action: "create",
        name: "نمونه",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await catalogPost(
        categoriesUrl,
        mediaCookie,
        { action: "create", name: "نمونه" },
        "https://untrusted.invalid",
      )
    ).status,
    403,
  );
  const catA = await catalogPost(categoriesUrl, mediaCookie, {
    action: "create",
    name: "سالاد",
    iconId: savedMedia.id,
  });
  assert.equal(catA.status, 201);
  const firstCategory = (await catA.json()).item;
  const catB = await catalogPost(categoriesUrl, mediaCookie, {
    action: "create",
    name: "خوراک",
  });
  assert.equal(catB.status, 201);
  const secondCategory = (await catB.json()).item;
  const orderResponse = await fetch(`${categoriesUrl}?order=all`, {
    headers: { cookie: mediaCookie },
  });
  const ordering = await orderResponse.json();
  assert.equal(
    (
      await catalogPost(categoriesUrl, mediaCookie, {
        action: "move",
        id: secondCategory.id,
        target: firstCategory.id,
        placement: "before",
        revision: ordering.revision,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await catalogPost(categoriesUrl, mediaCookie, {
        action: "move",
        id: firstCategory.id,
        target: secondCategory.id,
        placement: "before",
        revision: ordering.revision,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await (
        await fetch(categoriesUrl, { headers: { cookie: mediaCookie } })
      ).json()
    ).items[0].id,
    secondCategory.id,
  );
  const ingredient = await catalogPost(ingredientsUrl, mediaCookie, {
    action: "create",
    name: "پنیر",
    iconId: savedMedia.id,
  });
  assert.equal(ingredient.status, 201);
  const ingredientItem = (await ingredient.json()).item;
  assert.equal(
    (
      await catalogPost(ingredientsUrl, mediaCookie, {
        action: "create",
        name: "پنیر",
        iconId: savedMedia.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await catalogPost(categoriesUrl, mediaCookie, {
        action: "archive",
        id: firstCategory.id,
      })
    ).status,
    200,
  );
  assert.ok(
    (
      await authDb.db
        .collection("categories")
        .findOne({ _id: new mongoose.mongo.ObjectId(firstCategory.id) })
    ).deletedAt,
  );
  await authDb.db
    .collection("products")
    .createIndex({ slug: 1 }, { unique: true });
  const productsUrl = `${origin}/api/admin/products`;
  const productPayload = {
    action: "create",
    title: "محصول نمونه",
    excerpt: "توضیح نمونه",
    description: "متن ساده",
    categoryId: secondCategory.id,
    ingredientIds: [ingredientItem.id],
    gallery: [savedMedia.id],
    priceRials: 1000000,
    discountPriceRials: 800000,
    available: true,
    promoted: true,
  };
  assert.equal(
    (await fetch(productsUrl, { headers: { cookie: customerCookie } })).status,
    401,
  );
  assert.equal(
    (await catalogPost(productsUrl, customerCookie, productPayload)).status,
    401,
  );
  assert.equal(
    (
      await catalogPost(
        productsUrl,
        mediaCookie,
        productPayload,
        "https://untrusted.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await catalogPost(productsUrl, mediaCookie, {
        ...productPayload,
        discountPriceRials: 1000000,
      })
    ).status,
    400,
  );
  const productCreated = await catalogPost(
    productsUrl,
    mediaCookie,
    productPayload,
  );
  assert.equal(productCreated.status, 201);
  const activeProduct = (await productCreated.json()).item;
  assert.equal(activeProduct.seo.title, "محصول نمونه | بهارمز");
  const cartUrl = `${origin}/api/cart`;
  const cartPost = (cookie, body, requestOrigin = origin) =>
    fetch(cartUrl, {
      method: "POST",
      headers: {
        ...(cookie ? { cookie } : {}),
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const firstCart = await fetch(cartUrl);
  assert.equal(firstCart.status, 200);
  const guestCookie = firstCart.headers
    .get("set-cookie")
    .match(/lamsechi_guest_cart=[A-Za-z0-9_-]+/)[0];
  const guestRateId = `guest-cart:${Math.floor(Date.now() / 60000)}`;
  await authDb.db
    .collection("otpratebuckets")
    .updateOne(
      { _id: guestRateId },
      { $set: { count: 240, expiresAt: new Date(Date.now() + 120000) } },
      { upsert: true },
    );
  assert.equal(
    (await fetch(cartUrl, { headers: { cookie: guestCookie } })).status,
    200,
  );
  assert.equal(
    (
      await fetch(cartUrl, {
        headers: {
          cookie: `lamsechi_guest_cart=${randomBytes(32).toString("base64url")}`,
        },
      })
    ).status,
    429,
  );
  await authDb.db.collection("otpratebuckets").deleteOne({ _id: guestRateId });
  assert.equal(
    (
      await cartPost(guestCookie, {
        action: "add",
        productId: activeProduct.id,
        quantity: 0,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await cartPost(guestCookie, {
        action: "add",
        productId: activeProduct.id,
        quantity: 100,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await cartPost(guestCookie, {
        action: "add",
        productId: activeProduct.id,
        quantity: 1.5,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await cartPost(
        guestCookie,
        { action: "add", productId: activeProduct.id, quantity: 1 },
        "https://untrusted.invalid",
      )
    ).status,
    403,
  );
  const guestAdded = await cartPost(guestCookie, {
    action: "add",
    productId: activeProduct.id,
    quantity: 2,
  });
  assert.equal(guestAdded.status, 200);
  const guestCart = await guestAdded.json();
  assert.equal(guestCart.subtotalRials, 2000000);
  assert.equal(guestCart.discountRials, 400000);
  assert.equal(guestCart.itemsTotalRials, 1600000);
  assert.equal(guestCart.shippingRials, null);
  assert.equal(guestCart.totalRials, null);
  assert.equal(
    (
      await cartPost(customerCookie, {
        action: "add",
        productId: activeProduct.id,
        quantity: 1,
      })
    ).status,
    200,
  );
  const merged = await cartPost(`${customerCookie}; ${guestCookie}`, {
    action: "merge",
  });
  assert.equal((await merged.json()).items[0].quantity, 3);
  const replay = await cartPost(`${customerCookie}; ${guestCookie}`, {
    action: "merge",
  });
  assert.equal((await replay.json()).items[0].quantity, 3);
  assert.equal(
    (await (await fetch(cartUrl, { headers: { cookie: otherCookie } })).json())
      .items.length,
    0,
  );
  const oldGuest = await fetch(cartUrl);
  const oldGuestCookie = oldGuest.headers
    .get("set-cookie")
    .match(/lamsechi_guest_cart=[A-Za-z0-9_-]+/)[0];
  const oldDraftId = "1234567890abcdef1234567890abcdef";
  assert.equal(
    (
      await cartPost(oldGuestCookie, {
        action: "import",
        draftId: oldDraftId,
        draft: { [activeProduct.id]: 2 },
      })
    ).status,
    200,
  );
  const oldMerged = await cartPost(`${otherCookie}; ${oldGuestCookie}`, {
    action: "merge",
  });
  assert.equal((await oldMerged.json()).items[0].quantity, 2);
  const oldRetry = await cartPost(otherCookie, {
    action: "import",
    draftId: oldDraftId,
    draft: { [activeProduct.id]: 2 },
  });
  assert.equal((await oldRetry.json()).items[0].quantity, 2);
  const racingGuest = await fetch(cartUrl);
  const racingCookie = racingGuest.headers
    .get("set-cookie")
    .match(/lamsechi_guest_cart=[A-Za-z0-9_-]+/)[0];
  assert.equal(
    (
      await cartPost(racingCookie, {
        action: "add",
        productId: activeProduct.id,
        quantity: 1,
      })
    ).status,
    200,
  );
  const concurrentMerges = await Promise.all([
    cartPost(`${otherCookie}; ${racingCookie}`, { action: "merge" }),
    cartPost(`${otherCookie}; ${racingCookie}`, { action: "merge" }),
  ]);
  assert.ok(
    concurrentMerges.every((response) => [200, 409].includes(response.status)),
  );
  assert.equal(
    (await (await fetch(cartUrl, { headers: { cookie: otherCookie } })).json())
      .items[0].quantity,
    3,
  );
  assert.equal(
    (
      await (
        await cartPost(otherCookie, {
          action: "set",
          productId: activeProduct.id,
          quantity: 4,
        })
      ).json()
    ).items[0].quantity,
    4,
  );
  await authDb.db
    .collection("products")
    .updateOne(
      { _id: new mongoose.mongo.ObjectId(activeProduct.id) },
      { $set: { deletedAt: new Date() } },
    );
  assert.equal(
    (await (await fetch(cartUrl, { headers: { cookie: otherCookie } })).json())
      .items[0].status,
    "removed",
  );
  assert.equal(
    (
      await cartPost(otherCookie, {
        action: "remove",
        productId: activeProduct.id,
      })
    ).status,
    200,
  );
  await authDb.db
    .collection("products")
    .updateOne(
      { _id: new mongoose.mongo.ObjectId(activeProduct.id) },
      { $set: { deletedAt: null } },
    );
  assert.equal(
    (
      await catalogPost(categoriesUrl, mediaCookie, {
        action: "archive",
        id: secondCategory.id,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await catalogPost(ingredientsUrl, mediaCookie, {
        action: "archive",
        id: ingredientItem.id,
      })
    ).status,
    409,
  );
  const priceEdit = await catalogPost(productsUrl, mediaCookie, {
    action: "price",
    id: activeProduct.id,
    revision: activeProduct.revision,
    priceRials: 1200000,
    discountPriceRials: 900000,
  });
  assert.equal(priceEdit.status, 200);
  const changedCart = await (
    await fetch(cartUrl, { headers: { cookie: customerCookie } })
  ).json();
  assert.equal(changedCart.items[0].priceChanged, true);
  assert.equal(changedCart.subtotalRials, 3600000);
  assert.equal(changedCart.discountRials, 900000);
  assert.equal(changedCart.itemsTotalRials, 2700000);
  assert.equal(
    (
      await cartPost(customerCookie, {
        action: "acknowledge",
        productId: activeProduct.id,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await (
        await fetch(cartUrl, { headers: { cookie: customerCookie } })
      ).json()
    ).items[0].priceChanged,
    false,
  );
  await authDb.db
    .collection("products")
    .updateOne(
      { _id: new mongoose.mongo.ObjectId(activeProduct.id) },
      { $set: { available: false } },
    );
  const unavailableCart = await (
    await fetch(cartUrl, { headers: { cookie: customerCookie } })
  ).json();
  assert.equal(unavailableCart.items[0].status, "unavailable");
  assert.equal(unavailableCart.itemsTotalRials, 0);
  assert.equal(
    (
      await cartPost(customerCookie, {
        action: "add",
        productId: activeProduct.id,
        quantity: 1,
      })
    ).status,
    409,
  );
  await authDb.db
    .collection("products")
    .updateOne(
      { _id: new mongoose.mongo.ObjectId(activeProduct.id) },
      { $set: { available: true } },
    );
  const draftId = "00112233445566778899aabbccddeeff";
  const imported = await cartPost(customerCookie, {
    action: "import",
    draftId,
    draft: { [activeProduct.id]: 2 },
  });
  assert.equal((await imported.json()).items[0].quantity, 5);
  assert.equal(
    (
      await (
        await cartPost(customerCookie, {
          action: "import",
          draftId,
          draft: { [activeProduct.id]: 2 },
        })
      ).json()
    ).items[0].quantity,
    5,
  );
  assert.equal(
    (
      await catalogPost(productsUrl, mediaCookie, {
        action: "price",
        id: activeProduct.id,
        revision: activeProduct.revision,
        priceRials: 1300000,
        discountPriceRials: null,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await (
        await fetch(
          `${productsUrl}?availability=available&promotion=promoted`,
          { headers: { cookie: mediaCookie } },
        )
      ).json()
    ).total,
    1,
  );
  const publicListUrl = `${origin}/api/catalog`;
  const publicResponse = await fetch(
    `${publicListUrl}?category=${secondCategory.id}`,
  );
  assert.equal(publicResponse.status, 200);
  const publicData = await publicResponse.json();
  assert.equal(publicData.items[0].id, activeProduct.id);
  assert.equal(publicData.items[0].discountPriceRials, 900000);
  assert.equal("revision" in publicData.items[0], false);
  assert.equal((await fetch(`${publicListUrl}?cursor=broken`)).status, 400);
  assert.equal(
    (await fetch(`${publicListUrl}/media/${savedMedia.id}`)).status,
    200,
  );
  assert.equal(
    (await fetch(`${publicListUrl}/media/000000000000000000000000`)).status,
    404,
  );
  const publicCollection = authDb.db.collection("products");
  const seed = await publicCollection.findOne({
    _id: new mongoose.mongo.ObjectId(activeProduct.id),
  });
  await publicCollection.insertMany(
    Array.from({ length: 25 }, (_, index) => ({
      ...seed,
      _id: new mongoose.mongo.ObjectId(),
      slug: `test-pagination-${index}`,
      priceRials: 1000000,
      discountPriceRials: null,
    })),
  );
  for (const sort of ["newest", "cheapest", "expensive"]) {
    const ids = [];
    let cursor = null;
    do {
      const query = new URLSearchParams({ category: secondCategory.id, sort });
      if (cursor) query.set("cursor", cursor);
      const page = await (await fetch(`${publicListUrl}?${query}`)).json();
      ids.push(...page.items.map((item) => item.id));
      cursor = page.nextCursor;
    } while (cursor);
    assert.equal(ids.length, 26);
    assert.equal(new Set(ids).size, 26);
  }
  await publicCollection.deleteMany({ slug: /^test-pagination-/ });
  const contentUrl = `${origin}/api/content`;
  const adminContentUrl = `${origin}/api/admin/content`;
  const defaultContentResponse = await fetch(contentUrl);
  assert.equal(defaultContentResponse.status, 200);
  assert.match(defaultContentResponse.headers.get("cache-control"), /no-store/);
  const defaultContent = (await defaultContentResponse.json()).content;
  assert.equal(
    (await (await fetch(`${origin}/api/shop`)).json()).data.message,
    "فروشگاه آنلاین در حال آماده‌سازی است.",
  );
  assert.deepEqual(defaultContent.faq.items, []);
  assert.equal(defaultContent.seo.about.title, "");
  assert.equal(
    (await fetch(adminContentUrl, { headers: { cookie: customerCookie } }))
      .status,
    401,
  );
  const updateContent = (body, cookie = mediaCookie, requestOrigin = origin) =>
    fetch(adminContentUrl, {
      method: "PUT",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await updateContent(
        { revision: 0, content: defaultContent },
        customerCookie,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await updateContent(
        { revision: 0, content: defaultContent },
        mediaCookie,
        "https://other.invalid",
      )
    ).status,
    403,
  );
  await authDb.db.collection("contentsettings").insertOne({
    _id: "site",
    revision: 0,
    data: {
      homepage: { aboutTitle: "عنوان ناقص", internalSecret: "SECRET_MARKER" },
      secret: "SECRET_MARKER",
    },
  });
  const partial = await (await fetch(contentUrl)).json();
  assert.equal(partial.content.homepage.aboutTitle, "عنوان ناقص");
  assert.deepEqual(partial.content.contact.phones, []);
  assert.doesNotMatch(JSON.stringify(partial), /SECRET_MARKER/);
  const adminContent = await (
    await fetch(adminContentUrl, { headers: { cookie: mediaCookie } })
  ).json();
  const updatedContent = adminContent.content;
  updatedContent.homepage.slogans = [
    { id: "slogan1", text: "طعم تازه بهارمز" },
  ];
  updatedContent.homepage.banners = [
    {
      id: "banner1",
      imageId: savedMedia.id,
      href: "/products",
      alt: "محصولات",
    },
  ];
  updatedContent.faq.title = "پرسش‌های آزمون";
  updatedContent.faq.description = "توضیح پرسش‌ها";
  updatedContent.faq.items = [
    { id: "question1", title: "پرسش اول", body: "پاسخ" },
    { id: "question2", title: "پرسش دوم", body: "پاسخ دوم" },
  ];
  updatedContent.terms.title = "قوانین آزمون";
  updatedContent.terms.items = [
    { id: "term1", title: "قانون اول", body: "متن اول" },
    { id: "term2", title: "قانون دوم", body: "متن دوم" },
  ];
  updatedContent.contact.phones = [
    { id: "phone1", value: "09120000111" },
    { id: "phone2", value: "09120000222" },
  ];
  updatedContent.contact.socials = [
    {
      id: "social1",
      label: "پیام‌رسان آزمون",
      url: "https://example.com/chat",
    },
  ];
  updatedContent.seo.about.title = "درباره بهارمز";
  updatedContent.seo.about.description = "توضیح ویژه درباره";
  updatedContent.seo.home = {
    title: "عنوان ویژه خانه",
    description: "توضیح ویژه خانه",
  };
  updatedContent.seo.contact = {
    title: "عنوان ویژه تماس",
    description: "توضیح ویژه تماس",
  };
  updatedContent.seo.faq = {
    title: "عنوان ویژه پرسش",
    description: "توضیح ویژه پرسش",
  };
  updatedContent.seo.products = {
    title: "عنوان ویژه محصولات",
    description: "توضیح ویژه محصولات",
  };
  updatedContent.seo.terms = { title: "", description: "" };
  const invalid = structuredClone(updatedContent);
  invalid.contact.mapUrl = "javascript:alert(1)";
  assert.equal(
    (await updateContent({ revision: 0, content: invalid })).status,
    400,
  );
  invalid.contact.mapUrl = "https://example.com";
  invalid.homepage.banners[0].imageId = "000000000000000000000000";
  assert.equal(
    (await updateContent({ revision: 0, content: invalid })).status,
    400,
  );
  invalid.homepage.banners[0].imageId = null;
  invalid.contact.password = "SECRET_MARKER";
  assert.equal(
    (await updateContent({ revision: 0, content: invalid })).status,
    400,
  );
  const savedContent = await updateContent({
    revision: 0,
    content: updatedContent,
  });
  assert.equal(savedContent.status, 200);
  assert.equal((await savedContent.json()).revision, 1);
  assert.equal(
    (await updateContent({ revision: 0, content: updatedContent })).status,
    409,
  );
  const competing = await Promise.all([
    updateContent({ revision: 1, content: updatedContent }),
    updateContent({ revision: 1, content: updatedContent }),
  ]);
  assert.deepEqual(
    competing.map((response) => response.status).sort(),
    [200, 409],
  );
  const reorderedContent = structuredClone(updatedContent);
  reorderedContent.faq.items.reverse();
  reorderedContent.terms.items.reverse();
  reorderedContent.contact.phones.reverse();
  assert.equal(
    (await updateContent({ revision: 2, content: reorderedContent })).status,
    200,
  );
  const published = await (await fetch(contentUrl)).json();
  assert.equal(published.content.faq.items[0].body, "پاسخ دوم");
  assert.equal(published.content.terms.items[0].title, "قانون دوم");
  assert.equal(published.content.contact.phones[0].value, "09120000222");
  const faqHtml = await (await fetch(`${origin}/faq`)).text();
  assert.ok(
    faqHtml.indexOf("پرسش دوم") >= 0 &&
      faqHtml.indexOf("پرسش دوم") < faqHtml.indexOf("پرسش اول"),
  );
  assert.match(await (await fetch(`${origin}/terms`)).text(), /قانون دوم/);
  assert.match(
    await (await fetch(`${origin}/contact`)).text(),
    /پیام‌رسان آزمون/,
  );
  assert.equal(published.content.seo.about.title, "درباره بهارمز");
  for (const [path, title, description] of [
    ["/", "عنوان ویژه خانه", "توضیح ویژه خانه"],
    ["/about", "درباره بهارمز", "توضیح ویژه درباره"],
    ["/contact", "عنوان ویژه تماس", "توضیح ویژه تماس"],
    ["/faq", "عنوان ویژه پرسش", "توضیح ویژه پرسش"],
    ["/products", "عنوان ویژه محصولات", "توضیح ویژه محصولات"],
    ["/terms", "قوانین و شرایط | بهارمز", "قوانین و شرایط فروشگاه بهارمز"],
  ]) {
    const html = await (await fetch(`${origin}${path}`)).text();
    assert.ok(html.includes(`<title>${title}</title>`), `title for ${path}`);
    assert.ok(
      html.includes(`name="description" content="${description}"`),
      `description for ${path}`,
    );
    assert.ok(
      html.includes(`property="og:title" content="${title}"`),
      `open graph title for ${path}`,
    );
    assert.ok(
      html.includes(`property="og:description" content="${description}"`),
      `open graph description for ${path}`,
    );
    assert.ok(
      html.includes(`name="twitter:title" content="${title}"`),
      `twitter title for ${path}`,
    );
    assert.ok(
      html.includes(`rel="canonical" href="${origin}${path}"`),
      `canonical for ${path}`,
    );
  }
  const productHtml = await (
    await fetch(`${origin}/products/${activeProduct.slug}`)
  ).text();
  assert.match(productHtml, /<title>محصول نمونه \| بهارمز<\/title>/);
  const categoryHtml = await (
    await fetch(`${origin}/categories/${secondCategory.slug}`)
  ).text();
  assert.match(categoryHtml, /<title>خوراک \| بهارمز<\/title>/);
  assert.ok(
    productHtml.includes(
      `rel="canonical" href="${origin}/products/${encodeURIComponent(activeProduct.slug)}"`,
    ),
  );
  assert.match(productHtml, /"@type":"Product"/);
  const missingProduct = await (
    await fetch(`${origin}/products/missing-item`)
  ).text();
  assert.match(missingProduct, /noindex/);
  assert.doesNotMatch(missingProduct, /rel="canonical"/);
  const robots = await (await fetch(`${origin}/robots.txt`)).text();
  assert.match(robots, /Disallow: \/api\//);
  assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
  assert.ok(
    sitemap.includes(
      `${origin}/products/${encodeURIComponent(activeProduct.slug)}`,
    ),
  );
  assert.ok(
    sitemap.includes(
      `${origin}/categories/${encodeURIComponent(secondCategory.slug)}`,
    ),
  );
  assert.ok(
    !sitemap.includes(
      `${origin}/categories/${encodeURIComponent(firstCategory.slug)}`,
    ),
  );
  assert.doesNotMatch(
    sitemap,
    /\/account|\/checkout|\/admin|\/cart|SECRET_MARKER/,
  );
  const cartHtml = await (await fetch(`${origin}/cart`)).text();
  assert.match(cartHtml, /noindex/);
  assert.doesNotMatch(cartHtml, /rel="canonical"/);
  for (const [path, cookie] of [
    ["/account", customerCookie],
    ["/admin", mediaCookie],
    ["/checkout/address", customerCookie],
    ["/account/orders/TEST-ORDER-1", customerCookie],
  ]) {
    const html = await (
      await fetch(`${origin}${path}`, { headers: { cookie } })
    ).text();
    assert.match(html, /noindex/, `private noindex for ${path}`);
    assert.doesNotMatch(
      html,
      /rel="canonical"/,
      `no public canonical for ${path}`,
    );
  }
  assert.doesNotMatch(JSON.stringify(published), /SECRET_MARKER|revision/);
  assert.equal(
    (await (await fetch(`${origin}/api/shop`)).json()).data.message,
    "طعم تازه بهارمز",
  );
  assert.match(await (await fetch(`${origin}/`)).text(), /طعم تازه بهارمز/);
  await authDb.db
    .collection("contactbuckets")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const contactUrl = `${origin}/api/contact`;
  const adminMessages = `${origin}/api/admin/contact-submissions`;
  const sendContact = (body, requestOrigin = origin) =>
    fetch(contactUrl, {
      method: "POST",
      headers: { origin: requestOrigin, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const contactPayload = {
    name: "کاربر نمونه",
    mobile: "۰۹۱۲۳۴۵۶۷۸۹",
    message: "پیام آزمایشی <script>alert(1)</script>",
  };
  assert.equal(
    (await sendContact(contactPayload, "https://untrusted.invalid")).status,
    403,
  );
  assert.equal(
    (await sendContact({ ...contactPayload, mobile: "123" })).status,
    400,
  );
  for (let i = 0; i < 3; i++)
    assert.equal((await sendContact(contactPayload)).status, 201);
  assert.equal((await sendContact(contactPayload)).status, 429);
  const concurrentContact = await Promise.all(
    Array.from({ length: 6 }, () =>
      sendContact({ ...contactPayload, mobile: "09120000999" }),
    ),
  );
  assert.equal(
    concurrentContact.filter((response) => response.status === 201).length,
    3,
  );
  assert.ok(
    concurrentContact.every((response) => [201, 429].includes(response.status)),
  );
  assert.equal((await fetch(adminMessages)).status, 401);
  assert.equal(
    (await fetch(adminMessages, { headers: { cookie: customerCookie } }))
      .status,
    401,
  );
  const messages = await (
    await fetch(adminMessages, { headers: { cookie: mediaCookie } })
  ).json();
  assert.equal(messages.total, 6);
  assert.equal(
    messages.items.find((item) => item.mobile === "09123456789").message,
    contactPayload.message,
  );
  const messageId = messages.items[0].id;
  const adminMessageGet = (query, cookie = mediaCookie) =>
    fetch(`${adminMessages}?${query}`, { headers: { cookie } });
  assert.equal(
    (await adminMessageGet(`id=${messageId}`, customerCookie)).status,
    401,
  );
  assert.equal((await adminMessageGet("id=bad")).status, 400);
  assert.equal(
    (await adminMessageGet("id=000000000000000000000000")).status,
    404,
  );
  const detail = await (await adminMessageGet(`id=${messageId}`)).json();
  assert.equal(detail.item.message, contactPayload.message);
  assert.match(
    (await adminMessageGet(`id=${messageId}`)).headers.get("cache-control"),
    /no-store/,
  );
  assert.equal(
    (
      await (
        await adminMessageGet(`q=${encodeURIComponent("۰۹۱۲۳۴۵۶۷۸۹")}`)
      ).json()
    ).total,
    3,
  );
  assert.equal(
    (await (await adminMessageGet(`q=${encodeURIComponent(".*")}`)).json())
      .total,
    0,
  );
  assert.equal((await adminMessageGet("page=0")).status, 400);
  await authDb.db.collection("contactsubmissions").insertMany(
    Array.from({ length: 21 }, (_, i) => ({
      name: `فهرست آزمون ${i}`,
      mobile: "09120000222",
      message: "نمونه صفحه‌بندی",
      createdAt: new Date(),
    })),
  );
  const firstMessagePage = await (
    await adminMessageGet(`q=${encodeURIComponent("صفحه‌بندی")}&page=1`)
  ).json();
  const secondMessagePage = await (
    await adminMessageGet(`q=${encodeURIComponent("صفحه‌بندی")}&page=2`)
  ).json();
  assert.equal(firstMessagePage.total, 21);
  assert.equal(firstMessagePage.items.length, 20);
  assert.equal(secondMessagePage.items.length, 1);
  assert.equal(
    new Set(
      [...firstMessagePage.items, ...secondMessagePage.items].map(
        (item) => item.id,
      ),
    ).size,
    21,
  );
  await authDb.db
    .collection("contactsubmissions")
    .deleteMany({ name: /^فهرست آزمون / });
  const deliveryUrl = `${origin}/api/delivery`,
    policyUrl = `${origin}/api/admin/delivery`;
  const deliveryPost = (cookie, body, requestOrigin = origin) =>
    fetch(deliveryUrl, {
      method: "POST",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const policyPut = (cookie, body, requestOrigin = origin) =>
    fetch(policyUrl, {
      method: "PUT",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await fetch(policyUrl, { headers: { cookie: customerCookie } })).status,
    401,
  );
  const initialDelivery = await (
    await fetch(policyUrl, { headers: { cookie: mediaCookie } })
  ).json();
  assert.deepEqual(initialDelivery, {
    revision: 0,
    active: false,
    policy: null,
  });
  assert.equal(
    (
      await deliveryPost(customerCookie, {
        action: "options",
        addressId: savedAddress.id,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await (
        await deliveryPost(customerCookie, {
          action: "options",
          addressId: savedAddress.id,
        })
      ).json()
    ).status,
    "not_configured",
  );
  const samplePolicy = {
    zones: [
      {
        id: "test-zone",
        name: "محدوده آزمایشی",
        feeRials: 450000,
        polygon: [
          { lat: 35, lng: 51 },
          { lat: 35, lng: 52 },
          { lat: 36, lng: 52 },
          { lat: 36, lng: 51 },
        ],
      },
    ],
    slots: [
      {
        id: "test-slot",
        label: "بازه آزمایشی",
        weekdays: [1, 2, 3, 4, 5, 6, 7],
        start: "00:00",
        end: "23:59",
        capacity: null,
      },
    ],
    closures: [],
    leadMinutes: 0,
    cutoffDaysBefore: 0,
    cutoffTime: "23:59",
    horizonDays: 2,
    quoteTtlSeconds: 600,
  };
  assert.equal(
    (
      await policyPut(mediaCookie, {
        revision: 0,
        policy: { ...samplePolicy, apiKey: "SECRET_MARKER" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await policyPut(mediaCookie, {
        revision: 0,
        policy: {
          ...samplePolicy,
          zones: [{ ...samplePolicy.zones[0], feeRials: -10 }],
        },
      })
    ).status,
    400,
  );
  assert.doesNotMatch(
    await (await fetch(policyUrl, { headers: { cookie: mediaCookie } })).text(),
    /SECRET_MARKER|OTP_SECRET|AQAYE_PIN/,
  );
  assert.equal(
    (await policyPut(customerCookie, { revision: 0, policy: samplePolicy }))
      .status,
    401,
  );
  assert.equal(
    (
      await policyPut(
        mediaCookie,
        { revision: 0, policy: samplePolicy },
        "https://untrusted.invalid",
      )
    ).status,
    403,
  );
  assert.equal(
    (await policyPut(mediaCookie, { revision: 0, policy: samplePolicy }))
      .status,
    200,
  );
  assert.equal(
    (await policyPut(mediaCookie, { revision: 0, policy: samplePolicy }))
      .status,
    409,
  );
  const outsideAddress = (
    await (
      await addressPost(customerCookie, {
        action: "create",
        address: { ...addressPayload, coordinates: { lat: 0, lng: 0 } },
      })
    ).json()
  ).item;
  assert.equal(
    (
      await (
        await deliveryPost(customerCookie, {
          action: "options",
          addressId: outsideAddress.id,
        })
      ).json()
    ).status,
    "outside",
  );
  assert.equal(
    (
      await addressPost(customerCookie, {
        action: "delete",
        id: outsideAddress.id,
        revision: outsideAddress.revision,
      })
    ).status,
    200,
  );
  const missingCoordinates = (
    await (
      await addressPost(customerCookie, {
        action: "create",
        address: { ...addressPayload, coordinates: null },
      })
    ).json()
  ).item;
  assert.equal(
    (
      await (
        await deliveryPost(customerCookie, {
          action: "options",
          addressId: missingCoordinates.id,
        })
      ).json()
    ).status,
    "coordinates_required",
  );
  assert.equal(
    (
      await addressPost(customerCookie, {
        action: "delete",
        id: missingCoordinates.id,
        revision: missingCoordinates.revision,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await deliveryPost(otherCookie, {
        action: "options",
        addressId: savedAddress.id,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await deliveryPost(
        customerCookie,
        { action: "options", addressId: savedAddress.id },
        "https://untrusted.invalid",
      )
    ).status,
    403,
  );
  await authDb.db
    .collection("deliveryquotes")
    .createIndex({ tokenHash: 1 }, { unique: true });
  await authDb.db
    .collection("deliveryquotes")
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  const options = await (
    await deliveryPost(customerCookie, {
      action: "options",
      addressId: savedAddress.id,
    })
  ).json();
  assert.equal(options.status, "covered");
  const deliveryDate = options.days[1].date;
  assert.equal(options.days[1].slots[0].available, true);
  const manualUrl = `${origin}/api/admin/manual-order`;
  const manualCustomer = await authDb.db
    .collection("identitycustomers")
    .findOne({ mobile: "09120000124" });
  const manualCustomerId = String(manualCustomer._id);
  const manualPost = (body, cookie = mediaCookie, requestOrigin = origin) =>
    fetch(manualUrl, {
      method: "POST",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await fetch(`${manualUrl}?customer=${manualCustomerId}`)).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${manualUrl}?customer=${manualCustomerId}`, {
        headers: { cookie: customerCookie },
      })
    ).status,
    401,
  );
  const adminAddresses = await (
    await fetch(`${manualUrl}?customer=${manualCustomerId}`, {
      headers: { cookie: mediaCookie },
    })
  ).json();
  assert.ok(adminAddresses.items.some((item) => item.id === savedAddress.id));
  const manualBody = {
    action: "preview",
    customerId: manualCustomerId,
    addressId: savedAddress.id,
    date: deliveryDate,
    slotId: "test-slot",
    items: [{ productId: activeProduct.id, quantity: 5 }],
    transfer: "admin_confirmed",
  };
  assert.equal((await manualPost(manualBody, customerCookie)).status, 401);
  assert.equal(
    (await manualPost(manualBody, mediaCookie, "https://evil.example")).status,
    403,
  );
  assert.equal(
    (await manualPost({ ...manualBody, addressId: "000000000000000000000000" }))
      .status,
    409,
  );
  assert.equal(
    (
      await manualPost({
        ...manualBody,
        items: [{ productId: activeProduct.id, quantity: 0 }],
      })
    ).status,
    400,
  );
  const manualOrderPreviewResponse = await manualPost(manualBody);
  assert.equal(manualOrderPreviewResponse.status, 200);
  const manualPreview = await manualOrderPreviewResponse.json();
  assert.equal(manualPreview.shippingRials, 450000);
  assert.equal(manualPreview.totalRials, 4950000);
  assert.equal(manualPreview.transfer, "admin_confirmed");
  assert.equal(manualPreview.readyToCreate, false);
  assert.equal(
    (await manualPost({ ...manualBody, action: "create" })).status,
    409,
  );
  const quoteBody = {
    action: "quote",
    addressId: savedAddress.id,
    date: deliveryDate,
    slotId: "test-slot",
  };
  const quoteResponse = await deliveryPost(customerCookie, quoteBody);
  assert.equal(quoteResponse.status, 200);
  const quote = await quoteResponse.json();
  assert.equal(quote.shippingRials, 450000);
  assert.equal(quote.itemsTotalRials, 4500000);
  assert.equal(quote.totalRials, 4950000);
  assert.equal(
    (
      await deliveryPost(otherCookie, {
        action: "validate",
        token: quote.token,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await deliveryPost(customerCookie, {
        action: "validate",
        token: quote.token,
      })
    ).status,
    200,
  );
  await authDb.db
    .collection("products")
    .updateOne(
      { _id: new mongoose.mongo.ObjectId(activeProduct.id) },
      { $set: { priceRials: 1300000 } },
    );
  assert.equal(
    (
      await deliveryPost(customerCookie, {
        action: "validate",
        token: quote.token,
      })
    ).status,
    409,
  );
  await authDb.db
    .collection("products")
    .updateOne(
      { _id: new mongoose.mongo.ObjectId(activeProduct.id) },
      { $set: { priceRials: 1200000 } },
    );
  const cartQuote = await (
    await deliveryPost(customerCookie, quoteBody)
  ).json();
  assert.equal(
    (
      await cartPost(customerCookie, {
        action: "set",
        productId: activeProduct.id,
        quantity: 6,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await deliveryPost(customerCookie, {
        action: "validate",
        token: cartQuote.token,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await cartPost(customerCookie, {
        action: "set",
        productId: activeProduct.id,
        quantity: 5,
      })
    ).status,
    200,
  );
  const addressQuote = await (
    await deliveryPost(customerCookie, quoteBody)
  ).json();
  const currentAddress = (
    await (
      await fetch(addressUrl, { headers: { cookie: customerCookie } })
    ).json()
  ).items.find((item) => item.id === savedAddress.id);
  assert.equal(
    (
      await addressPost(customerCookie, {
        action: "update",
        id: savedAddress.id,
        revision: currentAddress.revision,
        address: {
          label: currentAddress.label,
          postalCode: currentAddress.postalCode,
          recipient: currentAddress.recipient,
          mobile: currentAddress.mobile,
          address: currentAddress.address,
          coordinates: currentAddress.coordinates,
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await deliveryPost(customerCookie, {
        action: "validate",
        token: addressQuote.token,
      })
    ).status,
    409,
  );
  const nextQuote = await (
    await deliveryPost(customerCookie, quoteBody)
  ).json();
  assert.equal(
    (
      await policyPut(mediaCookie, {
        revision: 1,
        policy: {
          ...samplePolicy,
          zones: [{ ...samplePolicy.zones[0], feeRials: 500000 }],
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await deliveryPost(customerCookie, {
        action: "validate",
        token: nextQuote.token,
      })
    ).status,
    409,
  );
  const expiring = await (await deliveryPost(customerCookie, quoteBody)).json();
  await authDb.db
    .collection("deliveryquotes")
    .updateOne(
      { tokenHash: createHash("sha256").update(expiring.token).digest("hex") },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
  assert.equal(
    (
      await deliveryPost(customerCookie, {
        action: "validate",
        token: expiring.token,
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await policyPut(mediaCookie, {
        revision: 2,
        policy: {
          ...samplePolicy,
          slots: [{ ...samplePolicy.slots[0], capacity: 2 }],
        },
      })
    ).status,
    200,
  );
  const capacityOptions = await (
    await deliveryPost(customerCookie, {
      action: "options",
      addressId: savedAddress.id,
    })
  ).json();
  assert.equal(capacityOptions.days[1].slots[0].available, false);
  assert.equal((await deliveryPost(customerCookie, quoteBody)).status, 409);
  assert.equal(
    (await policyPut(mediaCookie, { revision: 3, policy: null })).status,
    200,
  );
  const customerToken = customerCookie.split("=")[1];
  const ownerSession = await authDb.db.collection("identitysessions").findOne({
    tokenHash: createHash("sha256").update(customerToken).digest("hex"),
  });
  const orders = authDb.db.collection("orders");
  await orders.createIndex({ code: 1 }, { unique: true });
  await orders.insertOne({
    code: "TEST-ORDER-1",
    customerId: ownerSession.principalId,
    status: "delivered",
    placedAt: new Date(),
    items: [
      {
        title: "نام زمان سفارش",
        quantity: 2,
        unitRials: 900000,
        lineRials: 1800000,
        imageId: savedMedia.id,
      },
    ],
    customer: {
      name: "مشتری نمونه",
      mobile: "09120000124",
      secret: "never expose",
    },
    address: {
      recipient: "گیرنده نمونه",
      mobile: "09123456789",
      address: "نشانی زمان سفارش",
      postalCode: "",
    },
    delivery: { date: "1405/08/20", slotLabel: "صبح" },
    payment: {
      status: "verified",
      verifiedAt: new Date(),
      transactionReference: "TX-TEST",
      secret: "never expose",
    },
    totals: {
      subtotalRials: 2000000,
      discountRials: 200000,
      shippingRials: 100000,
      totalRials: 1900000,
      paidRials: 1900000,
    },
  });
  const adminOrdersUrl = `${origin}/api/admin/orders`;
  const adminOrdersGet = (query, cookie = mediaCookie) =>
    fetch(`${adminOrdersUrl}?${query}`, { headers: { cookie } });
  const adminOrdersPost = (
    body,
    cookie = mediaCookie,
    requestOrigin = origin,
  ) =>
    fetch(adminOrdersUrl, {
      method: "POST",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  assert.equal((await fetch(adminOrdersUrl)).status, 401);
  assert.equal(
    (await adminOrdersGet("code=TEST-ORDER-1", customerCookie)).status,
    401,
  );
  const originalOrder = await orders.findOne({ code: "TEST-ORDER-1" });
  const { _id: ignoredOrderId, ...managedOrder } = originalOrder;
  assert.ok(ignoredOrderId);
  await orders.insertOne({
    ...managedOrder,
    code: "MANAGED-ORDER",
    status: "preparing",
  });
  const orderBefore = await orders.findOne({ code: "MANAGED-ORDER" });
  const managedList = await (
    await adminOrdersGet("status=preparing&q=MANAGED")
  ).json();
  assert.equal(managedList.total, 1);
  assert.equal(managedList.items[0].code, "MANAGED-ORDER");
  assert.equal((await adminOrdersGet("code=UNKNOWN")).status, 404);
  assert.equal(
    (
      await adminOrdersPost({
        code: "MANAGED-ORDER",
        revision: 0,
        status: "delivered",
        note: "",
        totals: { totalRials: 1 },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await adminOrdersPost(
        { code: "MANAGED-ORDER", revision: 0, status: "delivered", note: "" },
        customerCookie,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await adminOrdersPost(
        { code: "MANAGED-ORDER", revision: 0, status: "delivered", note: "" },
        mediaCookie,
        "https://evil.example",
      )
    ).status,
    403,
  );
  const concurrent = await Promise.all([
    adminOrdersPost({
      code: "MANAGED-ORDER",
      revision: 0,
      status: "preparing",
      note: "یادداشت اول",
    }),
    adminOrdersPost({
      code: "MANAGED-ORDER",
      revision: 0,
      status: "preparing",
      note: "یادداشت دوم",
    }),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    (
      await adminOrdersPost({
        code: "MANAGED-ORDER",
        revision: 1,
        status: "delivered",
        note: "ارسال شد",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await adminOrdersPost({
        code: "MANAGED-ORDER",
        revision: 2,
        status: "cancelled",
        note: "لغو",
      })
    ).status,
    400,
  );
  const managedDetails = await (
    await adminOrdersGet("code=MANAGED-ORDER")
  ).json();
  assert.equal(managedDetails.order.adminRevision, 2);
  assert.equal(managedDetails.order.history.length, 2);
  assert.equal(managedDetails.order.history[1].status, "delivered");
  assert.doesNotMatch(JSON.stringify(managedDetails), /never expose/);
  const orderAfter = await orders.findOne({ code: "MANAGED-ORDER" });
  for (const field of [
    "customer",
    "address",
    "delivery",
    "payment",
    "items",
    "totals",
    "placedAt",
  ])
    assert.deepEqual(orderAfter[field], orderBefore[field]);
  await orders.deleteOne({ code: "MANAGED-ORDER" });
  const dashboardUrl = `${origin}/api/admin/dashboard`;
  assert.equal((await fetch(`${dashboardUrl}?section=metrics`)).status, 401);
  assert.equal(
    (
      await fetch(`${dashboardUrl}?section=metrics`, {
        headers: { cookie: customerCookie },
      })
    ).status,
    401,
  );
  const dashboardGet = (query) =>
    fetch(`${dashboardUrl}?${query}`, { headers: { cookie: mediaCookie } });
  assert.equal((await dashboardGet("section=metrics&period=bad")).status, 400);
  for (const period of ["day", "week", "month", "year"]) {
    const result = await dashboardGet(`section=metrics&period=${period}`);
    assert.equal(result.status, 200);
    const data = await result.json();
    assert.equal(
      data.chart.reduce((sum, point) => sum + point.amount, 0),
      1900000,
    );
    assert.equal(data.customers[0].amount, 1900000);
    assert.equal(data.products[0].quantity, 2);
    assert.doesNotMatch(JSON.stringify(data), /never expose/);
  }
  await orders.insertMany(
    Array.from({ length: 12 }, (_, i) => ({
      code: `DASH-${i}`,
      customerId: ownerSession.principalId,
      status: "preparing",
      placedAt: new Date(),
      items: [],
      customer: { name: "آزمون" },
      totals: { totalRials: 0 },
      payment: { status: "pending" },
    })),
  );
  const recent = await (
    await dashboardGet("section=orders&status=preparing")
  ).json();
  assert.equal(recent.total, 12);
  assert.equal(recent.items.length, 10);
  const allSecond = await (
    await dashboardGet("section=orders&status=preparing&all=1&page=2")
  ).json();
  assert.equal(allSecond.items.length, 0);
  await orders.deleteMany({ code: /^DASH-/ });
  await orders.insertOne({
    code: "INVALID-PAID",
    status: "preparing",
    customerId: ownerSession.principalId,
    placedAt: new Date(),
    items: [],
    payment: { status: "verified", verifiedAt: new Date() },
    totals: {},
  });
  assert.equal((await dashboardGet("section=metrics&period=week")).status, 503);
  await orders.deleteOne({ code: "INVALID-PAID" });
  const adminCustomersUrl = `${origin}/api/admin/customers`;
  const customersGet = (query = "", cookie = mediaCookie) =>
    fetch(`${adminCustomersUrl}?${query}`, { headers: { cookie } });
  const customersPost = (body, cookie = mediaCookie, requestOrigin = origin) =>
    fetch(adminCustomersUrl, {
      method: "POST",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  assert.equal((await fetch(adminCustomersUrl)).status, 401);
  assert.equal((await customersGet("", customerCookie)).status, 401);
  assert.equal(
    (
      await customersPost(
        {
          action: "create",
          firstName: "نمونه",
          lastName: "تست",
          mobile: "09120000555",
        },
        customerCookie,
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await customersPost(
        {
          action: "create",
          firstName: "نمونه",
          lastName: "تست",
          mobile: "09120000555",
        },
        mediaCookie,
        "https://evil.example",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await customersPost({
        action: "create",
        firstName: "ن",
        lastName: "تست",
        mobile: "bad",
      })
    ).status,
    400,
  );
  const created = await customersPost({
    action: "create",
    firstName: "مشتری",
    lastName: "مدیریتی",
    mobile: "۰۹۱۲۰۰۰۰۵۵۵",
  });
  assert.equal(created.status, 201);
  const managedId = (await created.json()).id;
  assert.equal(
    (
      await customersPost({
        action: "create",
        firstName: "مشتری",
        lastName: "تکراری",
        mobile: "+98 912 000 0555",
      })
    ).status,
    409,
  );
  const managedRow = await authDb.db
    .collection("identitycustomers")
    .findOne({ _id: new mongoose.Types.ObjectId(managedId) });
  assert.equal(managedRow.mobile, "09120000555");
  assert.equal(managedRow.mobileVerified, false);
  assert.equal(
    (await post({ action: "send", mobile: managedRow.mobile })).status,
    200,
  );
  const verifyManaged = await post({
    action: "verify",
    mobile: managedRow.mobile,
    code: await getCode(managedRow.mobile),
  });
  assert.equal(verifyManaged.status, 200);
  const managedCookie = verifyManaged.headers.get("set-cookie").split(";")[0];
  assert.equal(
    (await fetch(accountUrl, { headers: { cookie: managedCookie } })).status,
    200,
  );
  assert.equal(
    (
      await customersPost({
        action: "update",
        id: managedId,
        firstName: "نام",
        lastName: "ویرایش شده",
        mobile: "۰۹۱۲۰۰۰۰۵۵۵",
        expectedMobile: managedRow.mobile,
      })
    ).status,
    200,
  );
  assert.equal(
    (await fetch(accountUrl, { headers: { cookie: managedCookie } })).status,
    200,
  );
  assert.equal(
    (
      await customersPost({
        action: "update",
        id: managedId,
        firstName: "نام",
        lastName: "ویرایش شده",
        mobile: "09120000556",
        expectedMobile: managedRow.mobile,
      })
    ).status,
    200,
  );
  assert.equal(
    (await fetch(accountUrl, { headers: { cookie: managedCookie } })).status,
    401,
  );
  assert.equal(
    (
      await customersPost({
        action: "update",
        id: managedId,
        firstName: "نام",
        lastName: "قدیمی",
        mobile: "09120000557",
        expectedMobile: managedRow.mobile,
      })
    ).status,
    409,
  );
  assert.equal(
    (await post({ action: "send", mobile: "09120000556" })).status,
    200,
  );
  const newVerification = await post({
    action: "verify",
    mobile: "09120000556",
    code: await getCode("09120000556"),
  });
  assert.equal(newVerification.status, 200);
  const newManagedCookie = newVerification.headers
    .get("set-cookie")
    .split(";")[0];
  assert.equal(
    (await fetch(accountUrl, { headers: { cookie: newManagedCookie } })).status,
    200,
  );
  assert.equal(
    (await fetch(accountUrl, { headers: { cookie: managedCookie } })).status,
    401,
  );
  const matchingCustomers = await (
    await customersGet(
      `q=${encodeURIComponent("۰۹۱۲۰۰۰۰۵۵۶")}&verification=verified`,
    )
  ).json();
  assert.equal(matchingCustomers.total, 1);
  assert.equal(matchingCustomers.items[0].id, managedId);
  assert.equal(matchingCustomers.summary.purchaseRials, 1900000);
  const ownerCustomers = await (
    await customersGet(`q=${encodeURIComponent("09120000124")}`)
  ).json();
  assert.equal(ownerCustomers.items[0].orderCount, 1);
  assert.equal(ownerCustomers.items[0].purchaseRials, 1900000);
  assert.doesNotMatch(
    JSON.stringify(ownerCustomers),
    /passwordHash|never expose/,
  );
  await authDb.db.collection("identitycustomers").insertMany(
    Array.from({ length: 6 }, (_, i) => ({
      name: `صفحه بندی ${i}`,
      mobile: `0912000070${i}`,
      mobileVerified: false,
      createdAt: new Date(),
    })),
  );
  const filteredPage = await (
    await customersGet(
      `q=${encodeURIComponent("صفحه بندی")}&verification=unverified&limit=5&page=2`,
    )
  ).json();
  assert.equal(filteredPage.total, 6);
  assert.equal(filteredPage.items.length, 1);
  assert.equal(filteredPage.items[0].mobileVerified, false);
  await authDb.db
    .collection("identitycustomers")
    .deleteMany({ name: /^صفحه بندی / });
  const ordersUrl = `${origin}/api/account/orders`;
  assert.equal((await fetch(ordersUrl)).status, 401);
  const ownOrders = await (
    await fetch(ordersUrl, { headers: { cookie: customerCookie } })
  ).json();
  assert.equal(ownOrders.total, 1);
  assert.equal(ownOrders.items[0].items[0].title, "نام زمان سفارش");
  assert.doesNotMatch(JSON.stringify(ownOrders), /never expose/);
  assert.equal(
    (
      await (
        await fetch(ordersUrl, { headers: { cookie: otherCookie } })
      ).json()
    ).total,
    0,
  );
  assert.equal(
    (
      await fetch(`${ordersUrl}?code=TEST-ORDER-1`, {
        headers: { cookie: otherCookie },
      })
    ).status,
    404,
  );
  const privateImage = `${ordersUrl}/TEST-ORDER-1/media/${savedMedia.id}`;
  assert.equal(
    (await fetch(privateImage, { headers: { cookie: customerCookie } })).status,
    200,
  );
  assert.equal(
    (await fetch(privateImage, { headers: { cookie: otherCookie } })).status,
    404,
  );
  await authDb.db
    .collection("products")
    .updateOne(
      { _id: new mongoose.mongo.ObjectId(activeProduct.id) },
      { $set: { title: "نام تغییر یافته" } },
    );
  await authDb.db
    .collection("addresses")
    .updateOne(
      { _id: new mongoose.mongo.ObjectId(savedAddress.id) },
      { $set: { address: "نشانی تغییر یافته" } },
    );
  const snapshot = (
    await (
      await fetch(`${ordersUrl}?code=TEST-ORDER-1`, {
        headers: { cookie: customerCookie },
      })
    ).json()
  ).order;
  assert.equal(snapshot.items[0].title, "نام زمان سفارش");
  assert.equal(snapshot.address.address, "نشانی زمان سفارش");
  await authDb.db
    .collection("products")
    .updateOne(
      { _id: new mongoose.mongo.ObjectId(activeProduct.id) },
      { $set: { title: "محصول نمونه" } },
    );
  await authDb.db
    .collection("addresses")
    .updateOne(
      { _id: new mongoose.mongo.ObjectId(savedAddress.id) },
      { $set: { address: "نشانی ویرایش شده دستی" } },
    );
  const logoutToken = randomBytes(32).toString("base64url");
  await authDb.db.collection("identitysessions").insertOne({
    tokenHash: createHash("sha256").update(logoutToken).digest("hex"),
    principalType: "customer",
    principalId: String(otherCustomer.insertedId),
    expiresAt: new Date(Date.now() + 300000),
    revokedAt: null,
  });
  const logoutCookie = `lamsechi_customer_session=${logoutToken}`;
  const logoutUrl = `${origin}/api/account/logout`;
  const logout = (cookie, requestOrigin = origin) =>
    fetch(logoutUrl, {
      method: "POST",
      headers: {
        cookie,
        origin: requestOrigin,
        "content-type": "application/json",
      },
      body: "{}",
    });
  assert.equal(
    (await logout(logoutCookie, "https://untrusted.invalid")).status,
    403,
  );
  assert.equal(
    (await fetch(accountUrl, { headers: { cookie: logoutCookie } })).status,
    200,
  );
  const logoutResult = await logout(logoutCookie);
  assert.equal(logoutResult.status, 200);
  assert.match(
    logoutResult.headers.get("set-cookie"),
    /lamsechi_customer_session=/,
  );
  assert.equal(
    (await fetch(accountUrl, { headers: { cookie: logoutCookie } })).status,
    401,
  );
  assert.equal(
    (await fetch(accountUrl, { headers: { cookie: customerCookie } })).status,
    200,
  );
  assert.equal(
    (await fetch(mediaUrl, { headers: { cookie: mediaCookie } })).status,
    200,
  );
  await authDb.close();
  const isolated = await mongoose
    .createConnection(uri, {
      dbName: "lamsechi_test_lifecycle",
      serverSelectionTimeoutMS: 1000,
    })
    .asPromise();
  await isolated.db
    .collection("restart_probe")
    .insertOne({ value: "persisted" }, { writeConcern: { w: 1, j: true } });
  await isolated.close();
  await stop(db);
  await waitFor(
    async () => (await fetch(`${endpoint}/ready`)).status === 503,
    "readiness failure",
  );
  assert.equal((await fetch(contentUrl)).status, 503);
  assert.equal((await fetch(`${endpoint}/live`)).status, 200);
  db = startMongo();
  await waitFor(
    async () => (await fetch(`${endpoint}/ready`)).status === 200,
    "readiness recovery",
  );
  const afterRestart = await fetch(mediaReadUrl, {
    headers: { cookie: mediaCookie },
  });
  assert.equal(afterRestart.status, 200);
  assert.equal(
    (
      await (
        await fetch(cartUrl, { headers: { cookie: customerCookie } })
      ).json()
    ).items[0].quantity,
    5,
  );
  const persistedAddress = (
    await (
      await fetch(addressUrl, { headers: { cookie: customerCookie } })
    ).json()
  ).items[0];
  assert.equal(persistedAddress.address, "نشانی ویرایش شده دستی");
  assert.deepEqual(persistedAddress.coordinates, { lat: 35.72, lng: 51.43 });
  assert.equal(
    (
      await addressPost(customerCookie, {
        action: "delete",
        id: persistedAddress.id,
        revision: persistedAddress.revision,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await (
        await fetch(adminMessages, { headers: { cookie: mediaCookie } })
      ).json()
    ).total,
    6,
  );
  assert.equal(
    (await (await fetch(`${origin}/api/content`)).json()).content.homepage
      .slogans[0].text,
    "طعم تازه بهارمز",
  );
  const catalogAfterRestart = await fetch(categoriesUrl, {
    headers: { cookie: mediaCookie },
  });
  assert.equal(catalogAfterRestart.status, 200);
  const productAfterRestart = await fetch(
    `${productsUrl}?id=${activeProduct.id}`,
    { headers: { cookie: mediaCookie } },
  );
  assert.equal((await productAfterRestart.json()).item.priceRials, 1200000);
  assert.equal(
    (await catalogAfterRestart.json()).items[0].id,
    secondCategory.id,
  );
  assert.deepEqual(Buffer.from(await afterRestart.arrayBuffer()), mediaBytes);
  assert.deepEqual(
    Buffer.from(
      await (
        await fetch(videoReadUrl, { headers: { cookie: mediaCookie } })
      ).arrayBuffer(),
    ),
    mp4Bytes,
  );
  const reopened = await mongoose
    .createConnection(uri, {
      dbName: "lamsechi_test_lifecycle",
      serverSelectionTimeoutMS: 1000,
    })
    .asPromise();
  assert.equal(
    (
      await reopened.db
        .collection("restart_probe")
        .findOne({ value: "persisted" })
    )?.value,
    "persisted",
  );
  await reopened.close();
  if (process.env.CATALOG_BROWSER_EXECUTABLE) {
    const browserPort = await port();
    const browserOrigin = `http://127.0.0.1:${browserPort}`;
    const productionServer = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(browserPort),
      ],
      {
        env: {
          ...process.env,
          NODE_ENV: "production",
          MONGODB_URI: uri,
          APP_ORIGIN: browserOrigin,
          CONTACT_RATE_SECRET: "isolated-contact-secret-with-at-least-32-bytes",
          MONGODB_SERVER_SELECTION_TIMEOUT_MS: "500",
        },
        stdio: "ignore",
      },
    );
    try {
      await waitFor(
        async () =>
          (await fetch(`${browserOrigin}/api/health/live`)).status === 200,
        "production browser server",
      );
      const browserCase = spawnSync(
        process.execPath,
        ["tests/integration/catalog-browser.mjs"],
        {
          env: {
            ...process.env,
            CATALOG_TEST_ORIGIN: browserOrigin,
            CATALOG_TEST_TOKEN: mediaToken,
          },
          encoding: "utf8",
          timeout: 120000,
        },
      );
      if (browserCase.status !== 0)
        throw new Error(
          `Catalog browser test failed: ${browserCase.stdout}\n${browserCase.stderr}`,
        );
      console.log(browserCase.stdout.trim());
      const checkoutCase = spawnSync(
        process.execPath,
        ["tests/integration/checkout-browser.mjs"],
        {
          env: {
            ...process.env,
            CHECKOUT_TEST_ORIGIN: browserOrigin,
            CHECKOUT_CUSTOMER_TOKEN: customerCookie.split("=")[1],
          },
          encoding: "utf8",
          timeout: 120000,
        },
      );
      if (checkoutCase.status !== 0)
        throw new Error(
          `Checkout browser test failed: ${checkoutCase.stdout}\n${checkoutCase.stderr}`,
        );
      console.log(checkoutCase.stdout.trim());
    } finally {
      await stop(productionServer);
    }
  }
  console.log(
    "MongoDB integration passed: readiness, failure, restart and isolated data persistence.",
  );
  safeToRemove = true;
} finally {
  await stop(app);
  await stop(db);
  // Only remove the exact directory created by mkdtemp inside the resolved OS temp directory.
  if (
    safeToRemove &&
    path.dirname(temp) === tempRoot &&
    path.basename(temp).startsWith("lamsechi-mongo-test-")
  )
    await rm(temp, { recursive: true, force: true });
  else console.error(`Temporary test data retained at ${temp}`);
}
