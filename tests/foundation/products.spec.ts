import { expect, test } from "@playwright/test";
const item = {
  id: "111111111111111111111111",
  title: "محصول نمونه",
  slug: "sample",
  excerpt: "توضیح",
  description: "متن",
  gallery: [],
  categoryId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  ingredientIds: [],
  priceRials: 1000000,
  discountPriceRials: 800000,
  promoted: true,
  available: true,
  revision: 0,
  createdAt: "2026-11-09T10:00:00Z",
  updatedAt: "2026-11-09T10:00:00Z",
  category: { name: "خوراک", archived: false },
  seo: { title: "محصول نمونه | بهارمز", description: "توضیح" },
};
test("product list, quick price and create form use integer server values", async ({
  page,
}) => {
  const posts: Record<string, unknown>[] = [];
  await page.route("**/api/admin/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === "/api/admin/products") {
      if (request.method() === "POST") {
        posts.push(request.postDataJSON());
        return route.fulfill({ status: 200, json: { item } });
      }
      return route.fulfill({
        json: {
          items: [item],
          total: 1,
          page: 1,
          limit: 20,
          counts: { all: 1, available: 1, unavailable: 0, promoted: 1 },
        },
      });
    }
    if (url.pathname.endsWith("/categories"))
      return route.fulfill({
        json: {
          items: [{ id: item.categoryId, name: "خوراک" }],
          total: 1,
          page: 1,
          limit: 24,
        },
      });
    if (url.pathname.endsWith("/ingredients"))
      return route.fulfill({
        json: {
          items: [{ id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "پنیر" }],
          total: 1,
          page: 1,
          limit: 24,
        },
      });
    if (url.pathname === "/api/admin/media")
      return route.fulfill({
        json: {
          items: [
            {
              id: "cccccccccccccccccccccccc",
              filename: "عکس.webp",
              length: 10,
              uploadedAt: "2026-11-09T10:00:00Z",
              kind: "image",
              contentType: "image/webp",
              width: 20,
              height: 20,
            },
          ],
          total: 1,
          page: 1,
          limit: 24,
        },
      });
    return route.abort();
  });
  await page.goto("/product-test-probe");
  await expect(
    page
      .getByText("محصول نمونه", { exact: true })
      .locator("visible=true")
      .first(),
  ).toBeVisible();
  await expect(
    page.getByText("۱۰۰,۰۰۰ تومان").locator("visible=true").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "ویرایش قیمت محصول نمونه" }).click();
  const priceDialog = page.getByRole("dialog", { name: /ویرایش قیمت/ });
  await priceDialog.getByLabel("قیمت اصلی (تومان)").fill("۱۲۰۰۰۰");
  await priceDialog.getByLabel("قیمت پس از تخفیف (تومان)").fill("۹۰۰۰۰");
  await priceDialog.getByRole("button", { name: "ذخیره قیمت" }).click();
  await expect.poll(() => posts.at(-1)?.action).toBe("price");
  expect(posts.at(-1)?.priceRials).toBe(1200000);
  expect(posts.at(-1)?.discountPriceRials).toBe(900000);
  await page.getByRole("button", { name: "تغییر نمونه محصول" }).click();
  await page.getByRole("textbox", { name: "نام محصول" }).fill("محصول تازه");
  const description = page.getByRole("textbox", { name: "توضیحات محصول" });
  await description.fill("متن نمونه");
  await description.press("ControlOrMeta+A");
  await page.getByRole("button", { name: "درشت", exact: true }).click();
  await expect(description.locator("strong")).toHaveText("متن نمونه");
  await description.press("ArrowRight");
  await description.press("End");
  await description.press("Enter");
  await page.getByRole("combobox", { name: "ابزار جدول" }).click();
  await page.getByRole("option", { name: "درج جدول" }).click();
  await expect(description.locator("table")).toBeVisible();
  await page.getByRole("radio", { name: /خوراک/ }).check();
  await page.getByRole("checkbox", { name: /پنیر/ }).check();
  await page.getByLabel("قیمت اصلی (تومان)").fill("۲۵۰۰۰۰");
  await page.getByLabel("قیمت پس از تخفیف (تومان)").fill("۲۰۰۰۰۰");
  await page.getByRole("button", { name: "افزودن تصویر" }).click();
  await page
    .getByRole("dialog", { name: "انتخاب رسانه" })
    .getByRole("button", { name: /انتخاب عکس\.webp/ })
    .click();
  const pending = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/admin/products") &&
      request.method() === "POST" &&
      request.postDataJSON().action === "create",
  );
  await page.getByRole("button", { name: "ذخیره محصول" }).click();
  const payload = (await pending).postDataJSON();
  expect(payload.description).toMatch(/^rich:v1:.*<strong>متن نمونه<\/strong>/);
  expect(payload.description).toMatch(/<table(?:\s|>)/);
  expect(payload.priceRials).toBe(2500000);
  expect(payload.discountPriceRials).toBe(2000000);
  expect(payload.categoryId).toBe(item.categoryId);
  expect(payload.ingredientIds).toEqual(["bbbbbbbbbbbbbbbbbbbbbbbb"]);
  expect(payload.gallery).toEqual(["cccccccccccccccccccccccc"]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
