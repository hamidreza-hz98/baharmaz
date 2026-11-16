import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, cp, realpath, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import mongoose from "mongoose";

const { MongoClient, GridFSBucket } = mongoose.mongo;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) =>
    server.once("error", reject).listen(0, "127.0.0.1", resolve),
  );
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
const base = await realpath(os.tmpdir());
const root = await mkdtemp(path.join(base, "lamsechi-restore-test-"));
const source = path.join(root, "source"),
  backup = path.join(root, "backup"),
  restored = path.join(root, "restored");
let processHandle,
  client,
  complete = false;
const start = async (directory) => {
  const port = await freePort(),
    uri = `mongodb://127.0.0.1:${port}`;
  processHandle = spawn(
    process.env.MONGOD_BINARY || "mongod",
    ["--dbpath", directory, "--bind_ip", "127.0.0.1", "--port", String(port)],
    { stdio: "ignore" },
  );
  let spawnError;
  processHandle.on("error", (error) => {
    spawnError = error;
  });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (spawnError || processHandle.exitCode !== null)
      throw new Error("Isolated MongoDB did not start.");
    const candidate = new MongoClient(uri, { serverSelectionTimeoutMS: 300 });
    try {
      await candidate.connect();
      await candidate.db("admin").command({ ping: 1 });
      client = candidate;
      return uri;
    } catch {
      await candidate.close();
      await sleep(250);
    }
  }
  throw new Error("Isolated MongoDB startup timed out.");
};
const shutdown = async () => {
  const child = processHandle;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    await client.db("admin").command({ shutdown: 1, force: true });
  } catch {
    /* expected disconnect */
  }
  await client.close();
  client = undefined;
  await Promise.race([exited, sleep(10000)]);
  if (child.exitCode === null && child.signalCode === null)
    throw new Error("Isolated MongoDB did not stop cleanly.");
  if (child.exitCode !== 0)
    throw new Error(`MongoDB shutdown was not clean: ${child.exitCode}`);
  processHandle = undefined;
};
try {
  await mkdir(source);
  const uri = await start(source);
  const db = client.db("lamsechi_test_restore");
  await db
    .collection("restore_probe")
    .insertOne({ _id: "synthetic", value: "before-backup" });
  const bucket = new GridFSBucket(db, { bucketName: "media" });
  const bytes = Buffer.from("synthetic-media-backup-check");
  const upload = bucket.openUploadStream("fixture.webp", {
    metadata: { kind: "image", contentType: "image/webp" },
  });
  await pipeline(Readable.from(bytes), upload);
  const indexScripts = [
    "identity-indexes.mjs",
    "cart-indexes.mjs",
    "delivery-indexes.mjs",
    "address-indexes.mjs",
    "catalog-indexes.mjs",
    "contact-indexes.mjs",
    "order-indexes.mjs",
  ];
  for (let run = 0; run < 2; run++)
    for (const script of indexScripts) {
      const result = spawnSync(
        process.execPath,
        ["--conditions=react-server", `scripts/${script}`],
        {
          env: {
            ...process.env,
            NODE_ENV: "test",
            MONGODB_TEST_URI: uri,
            MONGODB_TEST_DB_NAME: "lamsechi_test_restore",
          },
          encoding: "utf8",
          timeout: 45000,
        },
      );
      if (result.status !== 0)
        throw new Error(
          `Isolated index operation failed: ${script} (run ${run + 1}): ${result.stdout}\n${result.stderr}`,
        );
    }
  await shutdown();
  await cp(source, backup, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  await cp(backup, restored, {
    recursive: true,
    errorOnExist: true,
    force: false,
  });
  await start(restored);
  const restoredDb = client.db("lamsechi_test_restore");
  assert.equal(
    (await restoredDb.collection("restore_probe").findOne({ _id: "synthetic" }))
      .value,
    "before-backup",
  );
  const chunks = [];
  for await (const chunk of new GridFSBucket(restoredDb, {
    bucketName: "media",
  }).openDownloadStream(upload.id))
    chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), bytes);
  assert.ok(
    (await restoredDb.collection("identitycustomers").indexes()).some(
      (index) => index.unique === true && index.key.mobile === 1,
    ),
  );
  await shutdown();
  complete = true;
  console.log(
    "Isolated cold backup and restore passed: document, GridFS bytes and repeat-safe indexes.",
  );
} finally {
  if (client) await client.close();
  if (
    processHandle &&
    processHandle.exitCode === null &&
    processHandle.signalCode === null
  )
    processHandle.kill();
  if (
    complete &&
    path.dirname(root) === base &&
    path.basename(root).startsWith("lamsechi-restore-test-")
  )
    await rm(root, { recursive: true, force: true });
  else if (!complete) console.error(`Isolated test data retained at ${root}`);
}
