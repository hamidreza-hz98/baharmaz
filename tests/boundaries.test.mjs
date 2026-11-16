import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ESLint } from "eslint";

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? filesBelow(path) : [path];
      }),
    )
  ).flat();
}

test("server runtime modules carry the server-only marker", async () => {
  const files = (await filesBelow("src/server")).filter((file) =>
    /\.[cm]?[jt]sx?$/.test(file),
  );
  assert.ok(files.length > 0);
  for (const file of files) {
    assert.match(
      await readFile(file, "utf8"),
      /^\s*import\s+["']server-only["'];/,
    );
  }
});

test("domain imports from server infrastructure are rejected by lint", async () => {
  const eslint = new ESLint();
  const [result] = await eslint.lintText(
    'import { x } from "@/server/shop/load-introduction"; void x;',
    { filePath: "src/modules/shop/probe.ts" },
  );
  assert.ok(
    result.messages.some(
      (message) => message.ruleId === "no-restricted-imports",
    ),
  );
});
