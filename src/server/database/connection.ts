import "server-only";
import mongoose from "mongoose";
import { getDatabaseConfig } from "@/server/config/database";

type ConnectionCache = { promise: Promise<typeof mongoose> | null };
const globalCache = globalThis as typeof globalThis & {
  __lamsechiMongo?: ConnectionCache;
};
const cache = (globalCache.__lamsechiMongo ??= { promise: null });

/** Share in-flight connection attempts across requests and development reloads. */
export async function connectDatabase(): Promise<typeof mongoose> {
  const config = getDatabaseConfig();
  if (mongoose.connection.readyState === 1) return mongoose;
  if (!cache.promise) {
    cache.promise = mongoose
      .connect(config.uri, {
        dbName: config.dbName,
        maxPoolSize: config.maxPoolSize,
        minPoolSize: 0,
        maxConnecting: 2,
        waitQueueTimeoutMS: 5000,
        serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
        bufferCommands: false,
        autoIndex: false,
        autoCreate: false,
      })
      .catch((error: unknown) => {
        cache.promise = null;
        throw error;
      });
  }
  try {
    return await cache.promise;
  } finally {
    // Mongoose owns reconnects after initial connection; permit a new attempt after disconnect.
    cache.promise = null;
  }
}

export async function pingDatabase(): Promise<void> {
  const connection = await connectDatabase();
  if (!connection.connection.db)
    throw new Error("MongoDB connection is unavailable.");
  await connection.connection.db.command({ ping: 1, maxTimeMS: 3000 });
}
