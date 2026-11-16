import mongoose from "mongoose";
import { getDatabaseConfig } from "../src/server/config/database.ts";
try {
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
  });
  const db = mongoose.connection.db;
  const cutoff = mongoose.mongo.ObjectId.createFromTime(
    Math.floor((Date.now() - 24 * 3600000) / 1000),
  );
  const candidates = await db
    .collection("media.chunks")
    .aggregate(
      [
        { $match: { files_id: { $type: "objectId", $lt: cutoff } } },
        { $group: { _id: "$files_id", chunks: { $sum: 1 } } },
        {
          $lookup: {
            from: "media.files",
            localField: "_id",
            foreignField: "_id",
            as: "file",
          },
        },
        { $match: { file: { $size: 0 } } },
        { $count: "files" },
      ],
      { allowDiskUse: true },
    )
    .toArray();
  console.log(
    `Possible orphaned uploads older than 24 hours: ${candidates[0]?.files ?? 0}. No data was deleted.`,
  );
} catch {
  console.error(
    "Media audit failed; check database connectivity and privileges.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
