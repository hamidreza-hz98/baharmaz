import { expect, test } from "@playwright/test";

const review = {
  subtotalRials: 1000000,
  discountRials: 100000,
  customer: { name: "سارا نمونه", mobile: "09120000000" },
  address: {
    label: "خانه",
    recipient: "سارا نمونه",
    mobile: "09120000000",
    address: "تهران، خیابان نمونه، پلاک ۱۲",
    postalCode: "1234567890",
  },
  items: [
    {
      id: "one",
      title: "کیک نمونه",
      image: "6af73bc0629100d2cdbce15f",
      quantity: 2,
      saleRials: 450000,
      lineRials: 900000,
    },
  ],
  delivery: {
    date: "1405/08/29",
    slot: { label: "صبح", start: "09:00", end: "12:00" },
    shippingRials: 450000,
    itemsTotalRials: 900000,
    totalRials: 1350000,
  },
};
test("review clearly shows recipient, products, delivery and total", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("lamsechi-delivery-quote", "sample"),
  );
  await page.route("**/api/order-review", (route) =>
    route.fulfill({ json: { review } }),
  );
  await page.route("**/api/catalog/media/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/review-test-probe");
  await expect(
    page
      .getByRole("navigation", { name: "مراحل خرید" })
      .getByText("تأیید نهایی"),
  ).toHaveAttribute("aria-current", "step");
  await expect(
    page.getByRole("heading", { name: "نشانی و گیرنده" }),
  ).toBeVisible();
  await expect(page.locator(".review-details > section h2")).toHaveText([
    "محصولات سفارش",
    "نشانی و گیرنده",
    "زمان تحویل",
  ]);
  await expect(page.getByText("سارا نمونه")).toHaveCount(1);
  await expect(page.getByText("تهران، خیابان نمونه، پلاک ۱۲")).toBeVisible();
  await expect(page.getByText("کیک نمونه")).toBeVisible();
  await expect(page.locator(".review-item-image img")).toHaveAttribute(
    "src",
    "/api/catalog/media/6af73bc0629100d2cdbce15f",
  );
  await expect(page.getByText("قیمت واحد: ۴۵,۰۰۰ تومان")).toBeVisible();
  await expect(page.getByText("۱۳۵,۰۰۰ تومان")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "ویرایش نشانی و گیرنده" }),
  ).toHaveAttribute("href", "/checkout/address");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("review uses a compact placeholder if the product image fails", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem("lamsechi-delivery-quote", "sample"),
  );
  await page.route("**/api/order-review", (route) =>
    route.fulfill({ json: { review } }),
  );
  await page.route("**/api/catalog/media/**", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto("/review-test-probe");
  await expect(page.locator(".review-item-image svg")).toBeVisible();
  await expect(page.locator(".review-item-image")).not.toContainText(
    "تصویری موجود نیست",
  );
});
test("expired quote offers a way back to delivery selection", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.removeItem("lamsechi-delivery-quote"),
  );
  await page.goto("/review-test-probe");
  await expect(
    page.getByRole("alert").filter({ hasText: "ابتدا زمان ارسال" }),
  ).toContainText("ابتدا زمان ارسال و هزینه را انتخاب کنید");
  await expect(
    page.getByRole("link", { name: "بازگشت به انتخاب ارسال" }),
  ).toHaveAttribute("href", "/checkout/address");
});
