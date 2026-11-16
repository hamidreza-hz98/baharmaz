import { test } from "node:test";
import assert from "node:assert/strict";
import { getShopIntroduction } from "../src/modules/shop/introduction.ts";
import { internalError, success } from "../src/shared/api-result.ts";

test("use case returns the injected public introduction", async () => {
  const expected = { name: "بهارمز", message: "به‌زودی" };
  assert.deepEqual(
    await getShopIntroduction({ read: async () => expected }),
    expected,
  );
});

test("reader errors are not disguised as successful results", async () => {
  await assert.rejects(
    getShopIntroduction({
      read: async () => {
        throw new Error("private detail");
      },
    }),
    /private detail/,
  );
});

test("API results use a safe error message", () => {
  assert.deepEqual(success(1), { ok: true, data: 1 });
  assert.equal(internalError().error.code, "INTERNAL_ERROR");
  assert.doesNotMatch(JSON.stringify(internalError()), /private detail/);
});
