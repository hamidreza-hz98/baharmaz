import mongoose from "mongoose";
import { getDatabaseConfig } from "../src/server/config/database.ts";
import { Customer, Session } from "../src/server/identity/identity.ts";
import { RegistrationTicket } from "../src/server/otp/customer-auth.ts";
import { OtpRateBucket } from "../src/server/otp/rate-limit.ts";
import { OtpChallenge } from "../src/server/otp/challenge.ts";
try {
  const config = getDatabaseConfig();
  await mongoose.connect(config.uri, {
    dbName: config.dbName,
    serverSelectionTimeoutMS: config.serverSelectionTimeoutMS,
    autoIndex: false,
  });
  await Customer.createIndexes();
  await Session.createIndexes();
  await RegistrationTicket.createIndexes();
  await OtpRateBucket.createIndexes();
  await OtpChallenge.createIndexes();
  console.log("Identity indexes created or already present.");
} catch {
  console.error(
    "Identity index creation failed. Check database access and duplicate data.",
  );
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
