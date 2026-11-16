import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import mongoose from "mongoose";
import sharp from "sharp";
import { getDatabaseConfig } from "../../src/server/config/database.ts";
import {
  prepareMedia,
  normalizeMediaFilename,
  storeMedia,
  getMedia,
  MAX_UPLOAD,
  IMAGE_LIMIT,
} from "../../src/server/media/storage.ts";
const config = getDatabaseConfig();
await mongoose.connect(config.uri, { dbName: config.dbName, autoIndex: false });
try {
  assert.equal(
    normalizeMediaFilename("../../عکس\u202e<script>.jpg", "webp"),
    "عکس-script.webp",
  );
  assert.equal(normalizeMediaFilename("../💛.jpg", "webp"), "media.webp");
  const image = await sharp({
    create: { width: 2500, height: 1250, channels: 3, background: "#a02020" },
  })
    .png()
    .toBuffer();
  const prepared = await prepareMedia(image, "../تست.png", "image/png");
  assert.equal(prepared.contentType, "image/webp");
  assert.equal(prepared.width, 2400);
  assert.equal(prepared.height, 1200);
  assert.equal((await sharp(prepared.bytes).metadata()).format, "webp");
  await assert.rejects(prepareMedia(image, "test.png", "image/jpeg"));
  await assert.rejects(prepareMedia(Buffer.alloc(0), "empty", "image/png"));
  await assert.rejects(
    prepareMedia(Buffer.alloc(MAX_UPLOAD + 1), "large", "image/png"),
  );
  await assert.rejects(
    prepareMedia(
      Buffer.concat([image, Buffer.alloc(IMAGE_LIMIT)]),
      "large.png",
      "image/png",
    ),
  );
  await assert.rejects(
    prepareMedia(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
      "broken.png",
      "image/png",
    ),
  );
  const video = await readFile("tests/fixtures/media/sample.mp4");
  const mp4 = await prepareMedia(video, "sample.mp4", "video/mp4");
  assert.equal(mp4.contentType, "video/mp4");
  assert.deepEqual(mp4.bytes, video);
  await assert.rejects(
    prepareMedia(video.subarray(0, 300), "broken.mp4", "video/mp4"),
  );
  const saved = await storeMedia(image, "../تست.png", "image/png");
  const videoSaved = await storeMedia(video, "sample.mp4", "video/mp4");
  const first = await getMedia(saved.id);
  assert.equal(first.file.filename, "تست.webp");
  await mongoose.disconnect();
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    autoIndex: false,
  });
  const reopened = await getMedia(saved.id);
  assert.equal(reopened.file.metadata.contentType, "image/webp");
  const chunks = [];
  for await (const chunk of reopened.storage.openDownloadStream(
    reopened.fileId,
  ))
    chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), prepared.bytes);
  const reopenedVideo = await getMedia(videoSaved.id);
  const videoChunks = [];
  for await (const chunk of reopenedVideo.storage.openDownloadStream(
    reopenedVideo.fileId,
  ))
    videoChunks.push(chunk);
  assert.deepEqual(Buffer.concat(videoChunks), video);
  assert.equal(await getMedia("not-an-id"), null);
  const orphanId = mongoose.mongo.ObjectId.createFromTime(
    Math.floor(Date.now() / 1000) - 90000,
  );
  await mongoose.connection.db
    .collection("media.chunks")
    .insertOne({ files_id: orphanId, n: 0, data: Buffer.from("orphan-test") });
  const audit = spawnSync(
    process.execPath,
    ["--conditions=react-server", "scripts/media-audit.mjs"],
    { env: process.env, encoding: "utf8", timeout: 30000 },
  );
  assert.equal(audit.status, 0, audit.stderr);
  assert.match(audit.stdout, /older than 24 hours: 1/);
  assert.ok(
    await mongoose.connection.db
      .collection("media.chunks")
      .findOne({ files_id: orphanId }),
  );
  console.log(
    "Media integration passed: validation, WebP, MP4 and persistence.",
  );
} finally {
  await mongoose.disconnect();
}
