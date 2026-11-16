import mongoose from "mongoose";
import { getDatabaseConfig } from "../src/server/config/database.ts";
import { bootstrapAdmin } from "../src/server/identity/identity.ts";
try {
  const username = process.env.ADMIN_BOOTSTRAP_USERNAME ?? "";
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
  if (!username || !password)
    throw new Error(
      "Set ADMIN_BOOTSTRAP_USERNAME and ADMIN_BOOTSTRAP_PASSWORD for this invocation.",
    );
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
    autoIndex: false,
    autoCreate: false,
  });
  const created = await bootstrapAdmin(username, password);
  console.log(
    created ? "Admin created." : "Admin already exists; no changes made.",
  );
} catch {
  // Driver errors may contain credentials. Never print them.
  console.error(
    "Admin bootstrap failed. Check configuration, password policy and database connectivity.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
