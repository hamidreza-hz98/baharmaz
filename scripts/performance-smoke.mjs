import { spawn } from "node:child_process";
import net from "node:net";
import { chromium } from "@playwright/test";

const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if (!executable)
  throw new Error("Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to a local browser.");
const socket = net.createServer();
await new Promise((resolve, reject) =>
  socket.once("error", reject).listen(0, "127.0.0.1", resolve),
);
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  { stdio: "ignore", env: { ...process.env, APP_ORIGIN: origin } },
);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null)
      throw new Error("Production server exited before readiness.");
    try {
      if ((await fetch(`${origin}/api/health/live`)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* retry */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!ready) throw new Error("Production server did not become ready.");
  browser = await chromium.launch({
    executablePath: executable,
    headless: true,
  });
  for (const viewport of [
    { name: "mobile", width: 393, height: 852 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "desktop", width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: viewport.width, height: viewport.height },
    });
    await page.addInitScript(() => {
      window.__qa = { lcp: null, cls: 0 };
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          window.__qa.lcp = entry.startTime;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries())
          if (!entry.hadRecentInput) window.__qa.cls += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    const response = await page.goto(`${origin}/admin/login`, {
      waitUntil: "networkidle",
    });
    if (!response?.ok())
      throw new Error(`Login page failed: ${response?.status()}`);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1000);
    const data = await page.evaluate(() => ({
      ...window.__qa,
      fcp:
        performance.getEntriesByName("first-contentful-paint")[0]?.startTime ??
        null,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    if (data.overflow) throw new Error(`${viewport.name}: horizontal overflow`);
    console.log(JSON.stringify({ viewport: viewport.name, ...data }));
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
