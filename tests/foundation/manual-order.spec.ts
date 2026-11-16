import { expect, test } from "@playwright/test";
test("manual order preview selects items, delivery and transfer without placing an order", async ({
  page,
}) => {
  await page.route("**/api/admin/customers?*", (route) =>
    route.fulfill({
      json: {
        items: [{ id: "customer", name: "مشتری نمونه", mobile: "09120000000" }],
      },
    }),
  );
  await page.route("**/api/admin/products?*", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "product",
            title: "محصول نمونه",
            priceRials: 100000,
            discountPriceRials: null,
          },
        ],
      },
    }),
  );
  await page.route("**/api/admin/manual-order?*", (route) =>
    route.fulfill({
      json: {
        items: [{ id: "address", label: "خانه", address: "نشانی نمونه" }],
      },
    }),
  );
  await page.route("**/api/admin/manual-order", (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({
      json:
        body.action === "options"
          ? {
              days: [
                {
                  date: "1405/08/20",
                  label: "تاریخ نمونه",
                  slots: [{ id: "slot", label: "صبح", available: true }],
                },
              ],
            }
          : {
              customer: { name: "مشتری نمونه" },
              delivery: { date: "1405/08/20", slotLabel: "صبح" },
              items: [
                {
                  productId: "product",
                  title: "محصول نمونه",
                  quantity: 1,
                  lineRials: 100000,
                },
              ],
              subtotalRials: 100000,
              discountRials: 0,
              shippingRials: 10000,
              totalRials: 110000,
              transfer: "admin_confirmed",
              readyToCreate: false,
            },
    });
  });
  await page.goto("/manual-order-test-probe");
  await page
    .getByRole("combobox", { name: "مشتری", exact: true })
    .selectOption("customer");
  await page
    .getByRole("combobox", { name: "نشانی", exact: true })
    .selectOption("address");
  await page.getByRole("button", { name: "دریافت زمان‌های ارسال" }).click();
  await page
    .getByRole("combobox", { name: "محصول", exact: true })
    .selectOption("product");
  await page.getByRole("button", { name: "افزودن یا ویرایش محصول" }).click();
  await page.getByLabel("تاریخ ارسال").selectOption("1405/08/20");
  await page.getByLabel("بازه ارسال").selectOption("slot");
  await page.getByLabel("وضعیت کارت به کارت").selectOption("admin_confirmed");
  await page.getByRole("button", { name: "محاسبه پیش‌نمایش" }).click();
  await expect(page.getByText("۱۱,۰۰۰ تومان")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "ثبت سفارش در دسترس نیست" }),
  ).toBeDisabled();
});
