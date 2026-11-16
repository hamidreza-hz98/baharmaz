import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3171",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run start -- --hostname 127.0.0.1 --port 3171",
    url: "http://127.0.0.1:3171/api/health/ready",
    reuseExistingServer: false,
    timeout: 60000,
    env: {
      MONGODB_URI: process.env.E2E_MONGODB_URI || "mongodb://127.0.0.1:1",
      MONGODB_SERVER_SELECTION_TIMEOUT_MS: "5000",
    },
  },
});
