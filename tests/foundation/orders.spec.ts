import { test, expect } from "@playwright/test";
test("order history filters, error recovery and snapshot details", async ({
  page,
}) => {
  let fail = true;
  const order = {
    code: "TEST-1",
    status: "delivered",
    placedAt: "2026-11-10T10:00:00.000Z",
    items: [
      {
        title: "نام زمان سفارش",
        quantity: 2,
        unitRials: 900000,
        lineRials: 1800000,
        imageId: null,
      },
    ],
    address: {
      recipient: "گیرنده",
      mobile: "09123456789",
      address: "نشانی زمان سفارش",
      postalCode: "",
    },
    delivery: { date: "1405/08/20", slotLabel: "صبح" },
    payment: { status: "verified", transactionReference: "TX-1" },
    totals: {
      subtotalRials: 2000000,
      discountRials: 200000,
      shippingRials: 100000,
      totalRials: 1900000,
      paidRials: 1900000,
    },
  };
  await page.route("**/api/account/orders?**", (route) => {
    const q = new URL(route.request().url()).searchParams;
    if (q.has("code")) return route.fulfill({ json: { order } });
    if (fail) {
      fail = false;
      return route.fulfill({ status: 503, json: { error: "failed" } });
    }
    return route.fulfill({
      json: {
        items: q.get("status") === "cancelled" ? [] : [order],
        total: 1,
        page: 1,
        limit: 20,
      },
    });
  });
  await page.goto("/orders-test-probe");
  await expect(
    page.getByRole("alert").filter({ hasText: "دریافت سفارش‌ها" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "تلاش دوباره" }).click();
  await expect(page.getByText("TEST-1").first()).toBeVisible();
  await page.getByRole("button", { name: "لغوشده" }).click();
  await expect(page.getByText("سفارشی برای این وضعیت پیدا نشد.")).toBeVisible();
  await page.getByRole("button", { name: "تغییر نمای سفارش" }).click();
  await expect(page.getByText("نشانی زمان سفارش")).toBeVisible();
  await expect(
    page.getByText("نام زمان سفارش", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(/TX-1/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
