import mongoose from "mongoose";
import { getDatabaseConfig } from "../src/server/config/database.ts";
import { Order } from "../src/server/orders/orders.ts";
try {
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
    autoIndex: false,
  });
  await Order.createIndexes();
  console.log("Order read indexes created or already present.");
} catch {
  console.error(
    "Order index creation failed; check database access and duplicate codes.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
