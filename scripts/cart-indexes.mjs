import mongoose from "mongoose";
import { getDatabaseConfig } from "../src/server/config/database.ts";
import { Cart } from "../src/server/cart/cart.ts";
try {
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
    autoIndex: false,
  });
  await Cart.createIndexes();
  console.log("Cart indexes created or already present.");
} catch {
  console.error("Cart index creation failed; check database access.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
