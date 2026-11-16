import { expect, test } from "@playwright/test";
test("admin order details preserve edits on conflict and allow reload", async ({
  page,
}) => {
  const order = {
    code: "TEST-1",
    status: "preparing",
    placedAt: "2026-11-11T12:00:00Z",
    customer: { name: "مشتری نمونه", mobile: "09120000000" },
    address: {
      recipient: "گیرنده",
      mobile: "09120000000",
      address: "نشانی سفارش",
      postalCode: "",
    },
    delivery: { date: "1405/08/20", slotLabel: "صبح" },
    items: [
      {
        title: "محصول سفارش",
        quantity: 2,
        unitRials: 100000,
        lineRials: 200000,
      },
    ],
    totals: {
      subtotalRials: 200000,
      discountRials: 0,
      shippingRials: 0,
      totalRials: 200000,
      paidRials: 200000,
    },
    payment: {
      status: "verified",
      transactionReference: "TX",
      verifiedAt: "2026-11-11T12:00:00Z",
    },
    adminRevision: 0,
    adminNote: "",
    history: [],
  };
  await page.route("**/api/admin/orders?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: params.has("code")
        ? { order }
        : {
            items: [
              {
                code: order.code,
                status: order.status,
                placedAt: order.placedAt,
                customerName: order.customer.name,
                mobile: order.customer.mobile,
                totalRials: 200000,
              },
            ],
            total: 1,
            page: 1,
            limit: 20,
          },
    });
  });
  await page.route("**/api/admin/orders", (route) =>
    route.fulfill({ status: 409, json: { error: "سفارش تغییر کرده است." } }),
  );
  await page.goto("/admin-orders-test-probe");
  await expect(page.getByRole("link", { name: "TEST-1" })).toHaveAttribute(
    "href",
    "/admin/orders/TEST-1",
  );
  await expect(page.getByText("نشانی سفارش")).toBeVisible();
  await page.getByLabel("وضعیت سفارش").selectOption("delivered");
  await page.getByLabel("یادداشت داخلی مدیر").fill("یادداشت نمونه");
  await page.getByRole("button", { name: "بررسی تغییرات" }).click();
  await page.getByRole("button", { name: "تأیید و ذخیره" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "سفارش تغییر کرده است",
  );
  await page.getByRole("button", { name: "انصراف" }).click();
  await expect(page.getByLabel("یادداشت داخلی مدیر")).toHaveValue(
    "یادداشت نمونه",
  );
  await page.getByRole("button", { name: "دریافت اطلاعات تازه" }).click();
  await expect(page.getByLabel("یادداشت داخلی مدیر")).toHaveValue("");
});
