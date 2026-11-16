import { test } from "node:test";
import assert from "node:assert/strict";
import { getDatabaseConfig } from "../src/server/config/database.ts";

test("missing and invalid configuration fails without disclosing the URI", () => {
  assert.throws(() => getDatabaseConfig({}), /MONGODB_URI is required/);
  assert.throws(
    () => getDatabaseConfig({ MONGODB_URI: "secret" }),
    (error) => !error.message.includes("secret"),
  );
  assert.throws(
    () =>
      getDatabaseConfig({
        MONGODB_URI: "mongodb://localhost:27017",
        MONGODB_MAX_POOL_SIZE: "0",
      }),
    /MONGODB_MAX_POOL_SIZE/,
  );
});

test("application database is fixed and test databases are isolated", () => {
  assert.equal(
    getDatabaseConfig({ MONGODB_URI: "mongodb://localhost:27017/another" })
      .dbName,
    "lamsechi",
  );
  const env = {
    NODE_ENV: "test",
    MONGODB_TEST_URI: "mongodb://127.0.0.1:27019",
    MONGODB_TEST_DB_NAME: "lamsechi_test_example",
  };
  assert.equal(getDatabaseConfig(env).dbName, "lamsechi_test_example");
  assert.throws(
    () =>
      getDatabaseConfig({
        ...env,
        MONGODB_TEST_URI: "mongodb://production.example:27017",
      }),
    /local/,
  );
  assert.throws(
    () => getDatabaseConfig({ ...env, MONGODB_TEST_DB_NAME: "lamsechi" }),
    /lamsechi_test_/,
  );
});
