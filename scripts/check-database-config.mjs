import { getDatabaseConfig } from "../src/server/config/database.ts";
try {
  const config = getDatabaseConfig();
  console.log(`Database configuration is valid (database: ${config.dbName}).`);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Invalid database configuration.",
  );
  process.exitCode = 1;
}
