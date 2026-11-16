import { expect, test } from "@playwright/test";
test("delivery settings preserve draft and require confirmation for disable", async ({
  page,
}) => {
  let count = 0;
  await page.route("**/api/admin/delivery", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: { revision: 2, active: true, policy: { zones: [] } },
      });
    count++;
    if (count === 1)
      return route.fulfill({
        status: 409,
        json: { error: "تنظیمات تغییر کرده است." },
      });
    const body = route.request().postDataJSON();
    return route.fulfill({
      json: { revision: 3, active: body.policy !== null, policy: body.policy },
    });
  });
  await page.goto("/operational-settings-test-probe");
  const editor = page.getByLabel("قوانین ارسال (JSON)");
  await editor.fill("{invalid");
  await page.getByRole("button", { name: "اعتبارسنجی و ذخیره قوانین" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "ساختار قوانین" }),
  ).toBeVisible();
  await editor.fill('{"zones": []}');
  await page.getByRole("button", { name: "اعتبارسنجی و ذخیره قوانین" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "پیش‌نویس شما حفظ شده است" }),
  ).toBeVisible();
  await expect(editor).toHaveValue('{"zones": []}');
  await page.getByRole("button", { name: "غیرفعال کردن ارسال" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "انصراف" }).click();
  await expect(editor).toHaveValue('{"zones": []}');
  await page.getByRole("button", { name: "غیرفعال کردن ارسال" }).click();
  await page.getByRole("button", { name: "تأیید غیرفعال‌سازی" }).click();
  await expect(page.getByText("ارسال غیرفعال شد.")).toBeVisible();
  await expect(editor).toHaveValue("");
});
