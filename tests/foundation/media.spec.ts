import { expect, test } from "@playwright/test";
const picture = {
  id: "111111111111111111111111",
  filename: "تصویر.webp",
  length: 512,
  uploadedAt: "2026-11-09T10:00:00Z",
  kind: "image",
  contentType: "image/webp",
  width: 100,
  height: 100,
};
const movie = {
  id: "222222222222222222222222",
  filename: "فیلم.mp4",
  length: 1000,
  uploadedAt: "2026-11-09T09:00:00Z",
  kind: "video",
  contentType: "video/mp4",
  width: 100,
  height: 100,
};
test("media library, upload retry and reusable picker work", async ({
  page,
}) => {
  let uploadCount = 0;
  await page.route("**/api/admin/media**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname !== "/api/admin/media") return route.abort();
    if (request.method() === "POST") {
      uploadCount++;
      await new Promise((resolve) => setTimeout(resolve, 300));
      return route.fulfill({
        status: uploadCount === 1 ? 503 : 201,
        json:
          uploadCount === 1
            ? { error: "خطای نمونه" }
            : { media: { id: picture.id } },
      });
    }
    const kind = url.searchParams.get("kind");
    const query = url.searchParams.get("q");
    const items = query
      ? []
      : [picture, movie].filter(
          (item) => !kind || kind === "all" || item.kind === kind,
        );
    return route.fulfill({
      json: { items, page: 1, limit: 24, total: items.length },
    });
  });
  await page.goto("/media-test-probe");
  await expect(page.getByRole("button", { name: "تصویر.webp" })).toBeVisible();
  await expect(
    page.getByText("پیش‌نمایش تصویر ممکن نیست.").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "فیلم.mp4" }).click();
  await expect(
    page.getByRole("dialog", { name: "جزئیات رسانه" }),
  ).toBeVisible();
  await expect(page.getByText("video/mp4")).toBeVisible();
  await page.getByRole("button", { name: "بستن", exact: true }).click();
  await page.getByRole("checkbox", { name: "انتخاب همه این صفحه" }).check();
  await expect(
    page.getByRole("button", { name: "کپی نام انتخاب‌شده‌ها" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "پاک‌کردن انتخاب" }).click();
  await page.getByRole("combobox", { name: "نوع رسانه" }).click();
  await page.getByRole("option", { name: "ویدئو" }).click();
  await expect(page.getByRole("button", { name: "فیلم.mp4" })).toBeVisible();
  await expect(page.getByRole("button", { name: "تصویر.webp" })).toHaveCount(0);
  await page.getByLabel("جست‌وجوی نام فایل").fill("ناشناخته");
  await page.getByRole("button", { name: "جست‌وجو" }).click();
  await expect(page.getByText("رسانه‌ای با این فیلتر پیدا نشد.")).toBeVisible();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "sample.png",
      mimeType: "image/png",
      buffer: Buffer.from("test-upload"),
    });
  await page.getByRole("button", { name: "بارگذاری sample.png" }).click();
  await expect(
    page.getByRole("progressbar", { name: "پیشرفت sample.png" }),
  ).toBeVisible();
  await expect(page.getByText("خطای نمونه")).toBeVisible();
  await page.getByRole("button", { name: "تلاش دوباره sample.png" }).click();
  await expect(page.getByText("بارگذاری و ذخیره انجام شد.")).toBeVisible();
  expect(uploadCount).toBe(2);
  await page.getByRole("button", { name: "باز کردن انتخابگر تصویر" }).click();
  const picker = page.getByRole("dialog", { name: "انتخاب رسانه" });
  await expect(
    picker.getByRole("button", { name: "تصویر.webp" }),
  ).toBeVisible();
  await expect(picker.getByRole("button", { name: "فیلم.mp4" })).toHaveCount(0);
  await picker.getByRole("button", { name: "انتخاب رسانه" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "تصویر.webp" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("library failure offers a working retry", async ({ page }) => {
  let allowSuccess = false;
  await page.route("**/api/admin/media**", async (route) => {
    if (
      route.request().method() !== "GET" ||
      new URL(route.request().url()).pathname !== "/api/admin/media"
    )
      return route.abort();
    return !allowSuccess
      ? route.fulfill({ status: 503, json: { error: "خطا" } })
      : route.fulfill({
          json: { items: [picture], page: 1, limit: 24, total: 1 },
        });
  });
  await page.goto("/media-test-probe");
  await expect(page.getByText("دریافت رسانه‌ها ممکن نشد.")).toBeVisible();
  allowSuccess = true;
  await page.getByRole("button", { name: "تلاش دوباره", exact: true }).click();
  await expect(page.getByRole("button", { name: "تصویر.webp" })).toBeVisible();
});

test("picker can upload a new image and then select it", async ({ page }) => {
  let uploaded = false;
  await page.route("**/api/admin/media**", async (route) => {
    const request = route.request();
    if (new URL(request.url()).pathname !== "/api/admin/media")
      return route.abort();
    if (request.method() === "POST") {
      uploaded = true;
      return route.fulfill({
        status: 201,
        json: { media: { id: picture.id } },
      });
    }
    return route.fulfill({
      json: {
        items: uploaded ? [picture] : [],
        page: 1,
        limit: 24,
        total: uploaded ? 1 : 0,
      },
    });
  });
  await page.goto("/media-test-probe");
  await page.getByRole("button", { name: "باز کردن انتخابگر تصویر" }).click();
  const picker = page.getByRole("dialog", { name: "انتخاب رسانه" });
  await picker.getByRole("tab", { name: "بارگذاری فایل" }).click();
  await picker.locator('input[type="file"]').setInputFiles({
    name: "new.png",
    mimeType: "image/png",
    buffer: Buffer.from("test"),
  });
  await picker.getByRole("button", { name: "بارگذاری new.png" }).click();
  await expect(picker.getByText("بارگذاری و ذخیره انجام شد.")).toBeVisible();
  await picker.getByRole("tab", { name: "کتابخانه" }).click();
  await picker.getByRole("button", { name: "انتخاب رسانه" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "تصویر.webp" }),
  ).toBeVisible();
});
