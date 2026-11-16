import mongoose from "mongoose";
import { getDatabaseConfig } from "../src/server/config/database.ts";
import {
  ContactSubmission,
  ContactBucket,
} from "../src/server/contact/contact.ts";
try {
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
    autoIndex: false,
  });
  await ContactSubmission.createIndexes();
  await ContactBucket.createIndexes();
  console.log("Contact indexes created or already present.");
} catch {
  console.error("Contact index creation failed; check database access.");
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
