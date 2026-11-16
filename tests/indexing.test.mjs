import test from "node:test";
import assert from "node:assert/strict";
import { publicOrigin } from "../src/server/config/public-origin.ts";
import { safeJsonLd } from "../src/server/content/structured-data.ts";
test("public origin rejects missing, credentialed, path and insecure production URLs", () => {
  assert.equal(publicOrigin({}), null);
  assert.equal(
    publicOrigin({ APP_ORIGIN: "https://user:pass@example.com" }),
    null,
  );
  assert.equal(publicOrigin({ APP_ORIGIN: "https://example.com/path" }), null);
  assert.equal(
    publicOrigin({ APP_ORIGIN: "https://example.com?secret=1" }),
    null,
  );
  assert.equal(
    publicOrigin({ APP_ORIGIN: "http://example.com", NODE_ENV: "production" }),
    null,
  );
  assert.equal(
    publicOrigin({
      APP_ORIGIN: "https://example.com/",
      NODE_ENV: "production",
    }),
    "https://example.com",
  );
  assert.equal(
    publicOrigin({
      APP_ORIGIN: "http://localhost:3000",
      NODE_ENV: "development",
    }),
    "http://localhost:3000",
  );
});
test("structured data cannot close its script element", () => {
  const value = { name: "</script><script>alert(1)</script>" };
  const output = safeJsonLd(value);
  assert.ok(!output.includes("<"));
  assert.deepEqual(JSON.parse(output), value);
});
