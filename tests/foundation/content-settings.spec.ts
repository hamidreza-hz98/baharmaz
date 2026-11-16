import { expect, test } from "@playwright/test";
import type { ContentSettings } from "../../src/shared/content";
test("content settings reorder, choose media and preserve drafts through conflicts", async ({
  page,
}) => {
  const seo = Object.fromEntries(
    ["home", "contact", "faq", "terms", "about", "products"].map((key) => [
      key,
      { title: "", description: "" },
    ]),
  ) as ContentSettings["seo"];
  const content = {
    homepage: {
      banners: [],
      slogans: [],
      aboutTitle: "",
      aboutText: "",
      aboutImageId: null,
    },
    contact: { phones: [], socials: [], address: "", mapUrl: "" },
    faq: { title: "", description: "", items: [] },
    terms: { title: "", description: "", items: [] },
    about: { title: "", body: "", imageId: null },
    seo,
  } satisfies ContentSettings;
  let attempts = 0;
  const submitted: ContentSettings[] = [];
  await page.route("**/api/admin/content", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { revision: 2, content } });
    const body = route.request().postDataJSON();
    submitted.push(body.content);
    attempts++;
    return attempts === 1
      ? route.fulfill({
          status: 409,
          json: { error: "تنظیمات تغییر کرده است." },
        })
      : route.fulfill({ json: { revision: 3, content: body.content } });
  });
  await page.route("**/api/admin/media**", (route) => {
    if (new URL(route.request().url()).pathname !== "/api/admin/media")
      return route.abort();
    return route.fulfill({
      json: {
        items: [
          {
            id: "111111111111111111111111",
            filename: "تصویر.webp",
            length: 512,
            uploadedAt: "2026-11-09T10:00:00Z",
            kind: "image",
            contentType: "image/webp",
            width: 100,
            height: 100,
          },
        ],
        page: 1,
        limit: 24,
        total: 1,
      },
    });
  });
  await page.goto("/content-settings-test-probe");
  const seoPreview = page.getByRole("region", { name: "پیش‌نمایش خانه" });
  await expect(seoPreview.getByText("فروشگاه | بهارمز")).toBeVisible();
  await expect(seoPreview.getByRole("progressbar")).toHaveAttribute(
    "value",
    "0",
  );
  await page.getByLabel("عنوان جست‌وجوی خانه").fill("عنوان ویژه خانه");
  await page.getByLabel("توضیح جست‌وجوی خانه").fill("توضیح ویژه خانه");
  await expect(seoPreview.getByText("عنوان ویژه خانه")).toBeVisible();
  await expect(seoPreview.getByRole("progressbar")).toHaveAttribute(
    "value",
    "2",
  );
  await expect(seoPreview).toContainText("رتبه جست‌وجو را پیش‌بینی نمی‌کند");
  await page.getByRole("button", { name: "افزودن بنر" }).click();
  await page.getByLabel("متن جایگزین بنر 1").fill("تصویر اصلی");
  await page.getByLabel("پیوند بنر 1").fill("/products");
  await page.getByRole("button", { name: "انتخاب تصویر بنر 1" }).click();
  const picker = page.getByRole("dialog", { name: "انتخاب رسانه" });
  await picker.getByRole("button", { name: "انتخاب رسانه" }).click();
  await page
    .getByRole("button", { name: "افزودن مورد پرسش‌های متداول" })
    .click();
  await page.getByLabel("عنوان مورد 1 پرسش‌های متداول").fill("پرسش اول");
  await page
    .getByRole("button", { name: "افزودن مورد پرسش‌های متداول" })
    .click();
  await page.getByLabel("عنوان مورد 2 پرسش‌های متداول").fill("پرسش دوم");
  await page
    .getByRole("button", { name: "انتقال مورد 2 پرسش‌های متداول به بالا" })
    .click();
  await expect(
    page.getByRole("button", {
      name: "انتقال مورد 1 پرسش‌های متداول به پایین",
    }),
  ).toBeFocused();
  await expect(page.getByLabel("عنوان مورد 1 پرسش‌های متداول")).toHaveValue(
    "پرسش دوم",
  );
  await page.getByRole("button", { name: "ذخیره تنظیمات" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "تغییرات ذخیره‌نشده حفظ شده‌اند" }),
  ).toBeVisible();
  await expect(page.getByLabel("عنوان مورد 1 پرسش‌های متداول")).toHaveValue(
    "پرسش دوم",
  );
  await page.getByRole("button", { name: "دریافت نسخه جدید" }).click();
  await page
    .getByRole("dialog", { name: "دریافت نسخه جدید" })
    .getByRole("button", { name: "انصراف" })
    .click();
  await page.getByRole("button", { name: "ذخیره تنظیمات" }).click();
  await expect(page.getByText("تنظیمات ذخیره شد.")).toBeVisible();
  expect(submitted.at(-1)?.homepage.banners[0].imageId).toBe(
    "111111111111111111111111",
  );
  expect(submitted.at(-1)?.faq.items.map((item) => item.title)).toEqual([
    "پرسش دوم",
    "پرسش اول",
  ]);
});
