import mongoose from "mongoose";
import { getDatabaseConfig } from "../src/server/config/database.ts";
import { Category, Ingredient } from "../src/server/catalog/catalog.ts";
import { Product } from "../src/server/products/products.ts";
try {
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
    autoIndex: false,
  });
  await Category.createIndexes();
  await Ingredient.createIndexes();
  await Product.createIndexes();
  console.log("Catalog indexes created or already present.");
} catch {
  console.error(
    "Catalog index creation failed. Check access and duplicate data.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
