import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/foundation",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3183",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 1024 },
        isMobile: false,
        hasTouch: true,
      },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3183",
    url: "http://127.0.0.1:3183/api/health/live",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
