import { test, expect } from "@playwright/test";
test("catalog retries a failed next page and keeps existing products", async ({
  page,
}) => {
  let failed = false;
  await page.route("**/api/cart", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("**/api/catalog?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("cursor") && !failed) {
      failed = true;
      return route.fulfill({ status: 503, json: { error: "failed" } });
    }
    const next = url.searchParams.has("cursor");
    const item = (id: string) => ({
      id,
      slug: id,
      title: `محصول ${id}`,
      image: null,
      priceRials: 100000,
      discountPriceRials: null,
      available: true,
      promoted: false,
    });
    return route.fulfill({
      json: {
        items: next ? [item("a"), item("b")] : [item("a")],
        total: 2,
        nextCursor: next ? null : "next",
      },
    });
  });
  await page.goto("/public-catalog-test-probe");
  await expect(page.getByText("محصول a")).toBeVisible();
  await expect(page.getByRole("button", { name: "تلاش دوباره" })).toBeVisible();
  await page.getByRole("button", { name: "تلاش دوباره" }).click();
  await expect(page.getByText("محصول b")).toBeVisible();
  await expect(page.getByText("محصول a")).toHaveCount(1);
  await page
    .getByRole("button", { name: "افزودن به سبد خرید" })
    .first()
    .click();
  await expect(page.getByText("به سبد خرید اضافه شد.")).toBeVisible();
  await expect(page.getByText("پانوشت فروشگاه")).toBeAttached();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("catalog exposes loading feedback during a slow request", async ({
  page,
}) => {
  await page.route("**/api/catalog?**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.fulfill({ json: { items: [], total: 0, nextCursor: null } });
  });
  await page.goto("/public-catalog-test-probe");
  await expect(page.getByText("در حال دریافت محصولات…").first()).toBeVisible();
  await expect(
    page.getByText("محصولی برای این انتخاب پیدا نشد."),
  ).toBeVisible();
});
