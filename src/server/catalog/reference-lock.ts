import "server-only";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
export class CatalogWriteBusy extends Error {}
/** A non-expiring, owner-bound mutex serializes product reference changes and catalog archival on standalone MongoDB. */
export async function withCatalogReferenceLock<T>(
  work: () => Promise<T>,
): Promise<T> {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database is not connected.");
  const locks = db.collection<{ _id: string; owner: string; createdAt: Date }>(
    "catalog_reference_locks",
  );
  const owner = randomBytes(24).toString("hex");
  try {
    await locks.insertOne({ _id: "global", owner, createdAt: new Date() });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    )
      throw new CatalogWriteBusy("Catalog changes are busy.");
    throw error;
  }
  try {
    return await work();
  } finally {
    await locks.deleteOne({ _id: "global", owner });
  }
}
