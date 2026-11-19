import { expect, test } from "@playwright/test";

test("delivery form preserves edits on conflict and confirms disabling", async ({
  page,
}) => {
  const policy = {
    zones: [
      {
        id: "zone-1",
        name: "تهران آزمایشی",
        feeRials: 450000,
        polygon: [
          { lat: 35.66, lng: 51.29 },
          { lat: 35.66, lng: 51.39 },
          { lat: 35.74, lng: 51.39 },
          { lat: 35.74, lng: 51.29 },
        ],
      },
    ],
    slots: [
      {
        id: "slot-1",
        label: "صبح",
        weekdays: [6, 7, 1],
        start: "09:00",
        end: "12:00",
        capacity: null,
      },
    ],
    closures: [],
    leadMinutes: 120,
    cutoffDaysBefore: 0,
    cutoffTime: "23:59",
    horizonDays: 7,
    quoteTtlSeconds: 600,
  };
  let writes = 0;
  await page.route("https://tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await page.route("**/api/admin/delivery", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { revision: 2, active: true, policy } });
    writes++;
    if (writes === 1)
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
  const fee = page.getByLabel("هزینه ارسال (تومان)");
  await expect(fee).toHaveValue("45000");
  await fee.fill("50000");
  await page.getByRole("button", { name: "ذخیره قوانین ارسال" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "تنظیمات تغییر کرده است" }),
  ).toContainText("پیش‌نویس شما حفظ شده است");
  await expect(fee).toHaveValue("50000");
  await page.getByRole("button", { name: "غیرفعال کردن ارسال" }).click();
  await page.getByRole("button", { name: "انصراف" }).click();
  await expect(fee).toHaveValue("50000");
  await page.getByRole("button", { name: "غیرفعال کردن ارسال" }).click();
  await page.getByRole("button", { name: "تأیید غیرفعال‌سازی" }).click();
  await expect(page.getByText("ارسال غیرفعال شد.")).toBeVisible();
  await expect(page.getByText("هنوز محدوده‌ای ثبت نشده است.")).toBeVisible();
});
