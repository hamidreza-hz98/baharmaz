import "server-only";
import mongoose from "mongoose";

export type DatabaseConfig = {
  uri: string;
  dbName: string;
  maxPoolSize: number;
  serverSelectionTimeoutMS: number;
};

function integerSetting(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (value === undefined || value === "") return fallback;
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return Number(value);
}

export function getDatabaseConfig(
  env: NodeJS.ProcessEnv = process.env,
): DatabaseConfig {
  const isTest = env.NODE_ENV === "test";
  const key = isTest ? "MONGODB_TEST_URI" : "MONGODB_URI";
  const uri = env[key]?.trim();
  if (!uri) throw new Error(`${key} is required.`);
  if (!/^mongodb(?:\+srv)?:\/\/\S+$/i.test(uri))
    throw new Error(`${key} must be a MongoDB connection URI.`);
  try {
    new mongoose.mongo.MongoClient(uri);
  } catch {
    throw new Error(`${key} must be a valid MongoDB connection URI.`);
  }
  let dbName = env.MONGODB_DB_NAME?.trim() || "lamsechi";
  if (isTest) {
    dbName = env.MONGODB_TEST_DB_NAME ?? "";
    if (!/^lamsechi_test_[a-z0-9_]{1,40}$/.test(dbName))
      throw new Error(
        "MONGODB_TEST_DB_NAME must start with lamsechi_test_ and contain only lowercase letters, digits, or underscores.",
      );
    // Test data must never be sent to a remote or authenticated deployment.
    if (!/^mongodb:\/\/(?:127\.0\.0\.1|localhost):\d+\/?(?:\?.*)?$/i.test(uri))
      throw new Error(
        "MONGODB_TEST_URI must point to an unauthenticated local MongoDB instance with an explicit port.",
      );
  }
  return {
    uri,
    dbName,
    maxPoolSize: integerSetting(
      env.MONGODB_MAX_POOL_SIZE,
      10,
      1,
      100,
      "MONGODB_MAX_POOL_SIZE",
    ),
    serverSelectionTimeoutMS: integerSetting(
      env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      5000,
      100,
      30000,
      "MONGODB_SERVER_SELECTION_TIMEOUT_MS",
    ),
  };
}
