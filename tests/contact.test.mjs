import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSubmission } from "../src/server/contact/contact.ts";
test("contact validates names, messages and normalizes Iranian mobiles", () => {
  assert.deepEqual(
    validateSubmission({
      name: "  مریم  ",
      mobile: "+۹۸۹۱۲۳۴۵۶۷۸۹",
      message: " پیام نمونه ",
    }),
    { name: "مریم", mobile: "09123456789", message: "پیام نمونه" },
  );
  for (const input of [
    { name: "م", mobile: "09123456789", message: "سلام دنیا" },
    { name: "مریم", mobile: "123", message: "سلام دنیا" },
    { name: "مریم", mobile: "09123456789", message: "کم" },
    {
      name: "مریم",
      mobile: "09123456789",
      message: "سلام دنیا",
      role: "admin",
    },
  ])
    assert.throws(() => validateSubmission(input), RangeError);
});
