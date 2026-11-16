import mongoose from "mongoose";
import { getDatabaseConfig } from "../src/server/config/database.ts";
import { Address } from "../src/server/address/address.ts";
try {
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
    autoIndex: false,
  });
  await Address.createIndexes();
  console.log("Address indexes created or already present.");
} catch {
  console.error("Address index creation failed; check database access.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
