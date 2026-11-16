import "server-only";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import mongoose from "mongoose";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { createFile, MP4BoxBuffer } from "mp4box";
import { withCatalogReferenceLock } from "../catalog/reference-lock.ts";

export const IMAGE_LIMIT = 10 * 1024 * 1024;
export const VIDEO_LIMIT = 25 * 1024 * 1024;
export const MAX_UPLOAD = VIDEO_LIMIT;
export class MediaValidationError extends Error {}
export function normalizeMediaFilename(
  name: string,
  extension: "webp" | "mp4",
) {
  const base = name.normalize("NFKC").split(/[\\/]/).pop() ?? "";
  const withoutExtension = base.replace(/\.[^.]*$/, "");
  const clean = withoutExtension
    .replace(
      /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
      "",
    )
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `${Array.from(clean || "media")
    .slice(0, 80)
    .join("")}.${extension}`;
}
function validateMp4(buffer: Buffer): { width: number; height: number } {
  let offset = 0;
  let boxCount = 0;
  const boxes = new Set<string>();
  while (offset < buffer.length) {
    if (++boxCount > 10000)
      throw new MediaValidationError("Too many MP4 boxes.");
    if (buffer.length - offset < 8)
      throw new MediaValidationError("Invalid MP4 container.");
    let length = buffer.readUInt32BE(offset);
    const name = buffer.toString("ascii", offset + 4, offset + 8);
    let header = 8;
    if (length === 1) {
      if (buffer.length - offset < 16)
        throw new MediaValidationError("Invalid MP4 container.");
      const size = buffer.readBigUInt64BE(offset + 8);
      if (size > BigInt(Number.MAX_SAFE_INTEGER))
        throw new MediaValidationError("Invalid MP4 container.");
      length = Number(size);
      header = 16;
    }
    if (length === 0) length = buffer.length - offset;
    if (length < header || offset + length > buffer.length)
      throw new MediaValidationError("Invalid MP4 container.");
    if (name === "mdat" && length <= header)
      throw new MediaValidationError("Empty MP4 media.");
    boxes.add(name);
    offset += length;
  }
  if (!["ftyp", "moov", "mdat"].every((name) => boxes.has(name)))
    throw new MediaValidationError("Incomplete MP4 container.");
  const file = createFile();
  let info: { width: number; height: number } | undefined;
  let invalid = false;
  file.onError = () => {
    invalid = true;
  };
  file.onReady = (movie) => {
    const video = movie.videoTracks[0];
    if (
      movie.isFragmented ||
      movie.videoTracks.length !== 1 ||
      !video ||
      !/^avc1\./.test(video.codec) ||
      !video.video ||
      !Number.isSafeInteger(video.video.width) ||
      !Number.isSafeInteger(video.video.height) ||
      !Number.isSafeInteger(video.nb_samples) ||
      !Number.isFinite(movie.duration) ||
      !Number.isFinite(movie.timescale) ||
      video.video.width < 1 ||
      video.video.height < 1 ||
      video.video.width > 3840 ||
      video.video.height > 2160 ||
      video.nb_samples < 1 ||
      movie.duration <= 0 ||
      movie.timescale <= 0 ||
      movie.duration / movie.timescale > 300
    ) {
      invalid = true;
      return;
    }
    info = { width: video.video.width, height: video.video.height };
  };
  try {
    file.appendBuffer(
      MP4BoxBuffer.fromArrayBuffer(Uint8Array.from(buffer).buffer, 0),
    );
    file.flush();
  } catch {
    throw new MediaValidationError("Invalid MP4 container.");
  }
  if (invalid || !info)
    throw new MediaValidationError("Unsupported MP4 video.");
  return info;
}
export async function prepareMedia(
  input: Buffer,
  filename: string,
  declaredType: string,
) {
  if (
    !Buffer.isBuffer(input) ||
    input.length === 0 ||
    input.length > MAX_UPLOAD
  )
    throw new MediaValidationError("Invalid file size.");
  let detected;
  try {
    detected = await fileTypeFromBuffer(input);
  } catch {
    throw new MediaValidationError("Invalid file contents.");
  }
  if (!detected || detected.mime !== declaredType)
    throw new MediaValidationError("File type does not match its contents.");
  if (detected.mime === "video/mp4") {
    if (input.length > VIDEO_LIMIT)
      throw new MediaValidationError("Video too large.");
    const dimensions = validateMp4(input);
    return {
      bytes: input,
      filename: normalizeMediaFilename(filename, "mp4"),
      contentType: "video/mp4" as const,
      kind: "video" as const,
      ...dimensions,
    };
  }
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(detected.mime) ||
    input.length > IMAGE_LIMIT
  )
    throw new MediaValidationError("Unsupported image type or size.");
  try {
    const image = sharp(input, {
      failOn: "warning",
      limitInputPixels: 40_000_000,
      animated: true,
    });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1)
      throw new MediaValidationError("Animated or invalid image.");
    const result = await image
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (result.data.length > IMAGE_LIMIT)
      throw new MediaValidationError("Processed image too large.");
    return {
      bytes: result.data,
      filename: normalizeMediaFilename(filename, "webp"),
      contentType: "image/webp" as const,
      kind: "image" as const,
      width: result.info.width,
      height: result.info.height,
    };
  } catch (error) {
    if (error instanceof MediaValidationError) throw error;
    throw new MediaValidationError("Image could not be decoded.");
  }
}
function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database is not connected.");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "media" });
}
export async function storeMedia(
  input: Buffer,
  filename: string,
  declaredType: string,
) {
  const prepared = await prepareMedia(input, filename, declaredType);
  const target = bucket().openUploadStream(prepared.filename, {
    metadata: {
      contentType: prepared.contentType,
      kind: prepared.kind,
      width: prepared.width,
      height: prepared.height,
      visibility: "private",
    },
  });
  try {
    await pipeline(Readable.from(prepared.bytes), target);
  } catch (error) {
    try {
      await target.abort();
    } catch {
      /* process interruption can require orphan cleanup */
    }
    throw error;
  }
  return {
    id: String(target.id),
    filename: prepared.filename,
    contentType: prepared.contentType,
    kind: prepared.kind,
    width: prepared.width,
    height: prepared.height,
    length: prepared.bytes.length,
  };
}
export async function getMedia(id: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;
  const storage = bucket();
  const fileId = new mongoose.mongo.ObjectId(id);
  const file = await storage.find({ _id: fileId }).limit(1).next();
  if (
    !file ||
    !file.metadata ||
    !["image/webp", "video/mp4"].includes(file.metadata.contentType) ||
    !Number.isSafeInteger(file.length) ||
    file.length < 1 ||
    file.length > MAX_UPLOAD
  )
    return null;
  return { storage, file, fileId };
}

export class MediaNotFoundError extends Error {}
export class MediaInUseError extends Error {}
export type MediaDeleteBlock = {
  id: string;
  reason: "in-use" | "not-found";
};

async function deleteMediaUnsafe(id: string): Promise<string> {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new RangeError("Invalid media id.");
  const target = id.toLowerCase();
  const media = await getMedia(target);
  if (!media) throw new MediaNotFoundError("Media not found.");
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database is not connected.");

  const [product, category, ingredient, order, content] = await Promise.all([
    db.collection("products").findOne({ gallery: target }, { projection: { _id: 1 } }),
    db.collection("categories").findOne(
      { $or: [{ imageId: target }, { iconId: target }] },
      { projection: { _id: 1 } },
    ),
    db.collection("ingredients").findOne({ iconId: target }, { projection: { _id: 1 } }),
    db.collection("orders").findOne(
      { "items.imageId": target },
      { projection: { _id: 1 } },
    ),
    db.collection<{ _id: string }>("contentsettings").findOne(
      {
        _id: "site",
        $or: [
          { "data.about.imageId": target },
          { "data.homepage.aboutImageId": target },
          { "data.homepage.banners.imageId": target },
        ],
      },
      { projection: { _id: 1 } },
    ),
  ]);
  if (product || category || ingredient || order || content)
    throw new MediaInUseError("Media is referenced by site data.");

  await media.storage.delete(media.fileId);
  return target;
}

export async function deleteMedia(id: string): Promise<string> {
  return withCatalogReferenceLock(() => deleteMediaUnsafe(id));
}

export async function deleteMediaBatch(ids: readonly string[]): Promise<{
  deletedIds: string[];
  blocked: MediaDeleteBlock[];
}> {
  if (
    !Array.isArray(ids) ||
    ids.length < 1 ||
    ids.length > 24 ||
    ids.some((id) => typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)) ||
    new Set(ids.map((id) => id.toLowerCase())).size !== ids.length
  )
    throw new RangeError("Invalid media id list.");

  return withCatalogReferenceLock(async () => {
    const deletedIds: string[] = [];
    const blocked: MediaDeleteBlock[] = [];
    for (const id of ids) {
      try {
        deletedIds.push(await deleteMediaUnsafe(id));
      } catch (error) {
        if (error instanceof MediaInUseError)
          blocked.push({ id, reason: "in-use" });
        else if (error instanceof MediaNotFoundError)
          blocked.push({ id, reason: "not-found" });
        else throw error;
      }
    }
    return { deletedIds, blocked };
  });
}

export async function listMedia(options: {
  kind: "all" | "image" | "video";
  query: string;
  page: number;
  limit: number;
}) {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database is not connected.");
  const search = options.query.trim();
  if (search.length > 80 || /[\u0000-\u001f\u007f]/.test(search))
    throw new RangeError("Invalid search.");
  if (
    !["all", "image", "video"].includes(options.kind) ||
    !Number.isInteger(options.page) ||
    options.page < 1 ||
    options.page > 1000 ||
    !Number.isInteger(options.limit) ||
    options.limit < 1 ||
    options.limit > 48
  )
    throw new RangeError("Invalid pagination.");
  const supported =
    options.kind === "image"
      ? [{ "metadata.kind": "image", "metadata.contentType": "image/webp" }]
      : options.kind === "video"
        ? [{ "metadata.kind": "video", "metadata.contentType": "video/mp4" }]
        : [
            { "metadata.kind": "image", "metadata.contentType": "image/webp" },
            { "metadata.kind": "video", "metadata.contentType": "video/mp4" },
          ];
  const filter: Record<string, unknown> = { $or: supported };
  if (search)
    filter.filename = {
      $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  const collection = db.collection("media.files");
  const [files, total] = await Promise.all([
    collection
      .find(filter, {
        projection: {
          filename: 1,
          length: 1,
          uploadDate: 1,
          "metadata.kind": 1,
          "metadata.contentType": 1,
          "metadata.width": 1,
          "metadata.height": 1,
        },
      })
      .sort({ uploadDate: -1, _id: -1 })
      .skip((options.page - 1) * options.limit)
      .limit(options.limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);
  return {
    items: files.map((file) => ({
      id: String(file._id),
      filename: file.filename as string,
      length: file.length as number,
      uploadedAt: file.uploadDate as Date,
      kind: file.metadata?.kind as "image" | "video",
      contentType: file.metadata?.contentType as string,
      width: file.metadata?.width as number,
      height: file.metadata?.height as number,
    })),
    page: options.page,
    limit: options.limit,
    total,
  };
}
