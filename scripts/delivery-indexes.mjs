import mongoose from "mongoose";
import { getDatabaseConfig } from "../src/server/config/database.ts";
import { DeliveryQuote } from "../src/server/delivery/delivery.ts";
try {
  const c = getDatabaseConfig();
  await mongoose.connect(c.uri, {
    dbName: c.dbName,
    serverSelectionTimeoutMS: c.serverSelectionTimeoutMS,
    autoIndex: false,
  });
  await DeliveryQuote.createIndexes();
  console.log("Delivery quote indexes created or already present.");
} catch {
  console.error("Delivery index creation failed; check database access.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
