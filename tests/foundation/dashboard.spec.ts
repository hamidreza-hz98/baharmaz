import { expect, test } from "@playwright/test";

test("dashboard handles empty, error, retry and period selection", async ({
  page,
}) => {
  let failMetrics = true;
  await page.route("**/api/admin/dashboard?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("section") === "orders")
      return route.fulfill({
        json: { items: [], page: 1, limit: 10, total: 0 },
      });
    if (failMetrics)
      return route.fulfill({ status: 503, json: { error: "error" } });
    return route.fulfill({
      json: {
        chart: [{ label: "2026-11-11", amount: 0, count: 1 }],
        customers: [],
        products: [],
      },
    });
  });
  await page.goto("/dashboard-test-probe");
  await expect(page.getByText("سفارشی در این وضعیت وجود ندارد.")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "پیش‌نمایش سفارش دستی" }),
  ).toHaveAttribute("href", "/admin/orders/new");
  await expect(
    page.getByRole("button", { name: "تلاش دوباره" }).first(),
  ).toBeVisible();
  failMetrics = false;
  await page.getByRole("button", { name: "تلاش دوباره" }).first().click();
  await expect(page.getByText("۰ تومان")).toBeVisible();
  await page.getByLabel("بازه").selectOption("year");
  await expect(page.getByText("۰ تومان")).toBeVisible();
  await page.getByRole("button", { name: "تحویل‌شده" }).click();
  await expect(page.getByText("سفارشی در این وضعیت وجود ندارد.")).toBeVisible();
});
