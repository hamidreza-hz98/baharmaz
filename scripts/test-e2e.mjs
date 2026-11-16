import { spawn } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = net.createServer();
await new Promise((resolve, reject) =>
  server.once("error", reject).listen(0, "127.0.0.1", resolve),
);
const port = server.address().port;
await new Promise((resolve, reject) =>
  server.close((error) => (error ? reject(error) : resolve())),
);
const root = await realpath(os.tmpdir());
const directory = await mkdtemp(path.join(root, "lamsechi-e2e-mongo-"));
const mongo = spawn(
  process.env.MONGOD_BINARY || "mongod",
  ["--dbpath", directory, "--bind_ip", "127.0.0.1", "--port", String(port)],
  { stdio: "ignore" },
);
let spawnError;
mongo.on("error", (error) => {
  spawnError = error;
});
let safeToRemove = false;
try {
  const deadline = Date.now() + 45000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    if (spawnError) throw spawnError;
    if (mongo.exitCode !== null)
      throw new Error(`Isolated MongoDB exited: ${mongo.exitCode}`);
    ready = await new Promise((resolve) => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (!ready) await sleep(250);
  }
  if (!ready) throw new Error("Isolated MongoDB startup timed out.");
  const browser = spawn(
    process.execPath,
    ["node_modules/@playwright/test/cli.js", "test"],
    {
      stdio: "inherit",
      env: { ...process.env, E2E_MONGODB_URI: `mongodb://127.0.0.1:${port}` },
    },
  );
  const status = await new Promise((resolve, reject) => {
    browser.once("error", reject);
    browser.once("exit", (code) => resolve(code));
  });
  process.exitCode = status ?? 1;
} finally {
  if (mongo.exitCode === null && mongo.signalCode === null && !spawnError) {
    const exited = new Promise((resolve) => mongo.once("exit", resolve));
    mongo.kill();
    await Promise.race([exited, sleep(10000)]);
  }
  safeToRemove = Boolean(
    spawnError || mongo.exitCode !== null || mongo.signalCode !== null,
  );
  if (
    safeToRemove &&
    path.dirname(directory) === root &&
    path.basename(directory).startsWith("lamsechi-e2e-mongo-")
  )
    await rm(directory, { recursive: true, force: true });
  else console.error(`Temporary database retained: ${directory}`);
}
