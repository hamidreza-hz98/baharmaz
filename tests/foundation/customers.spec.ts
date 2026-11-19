import { expect, test } from "@playwright/test";
test("customer management displays totals and handles create, edit and errors", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/api/admin/customers?*", (route) => {
    if (failed) return route.fulfill({ status: 503, json: {} });
    return route.fulfill({
      json: {
        page: 1,
        limit: 10,
        total: 1,
        summary: { customers: 1, unverified: 1, purchaseRials: 120000 },
        items: [
          {
            id: "1",
            name: "مشتری نمونه",
            firstName: "مشتری",
            lastName: "نمونه",
            mobile: "09120000000",
            mobileVerified: false,
            orderCount: 2,
            purchaseRials: 120000,
            createdAt: "2026-11-11T12:00:00Z",
          },
        ],
      },
    });
  });
  await page.route("**/api/admin/customers", (route) =>
    route.fulfill({ status: 409, json: { error: "شماره همراه تکراری است." } }),
  );
  await page.goto("/customers-test-probe");
  await expect(
    page.getByRole("alert").filter({ hasText: "دریافت مشتریان ممکن نشد" }),
  ).toBeVisible();
  failed = false;
  await page.getByRole("button", { name: "تلاش دوباره" }).click();
  await expect(page.getByText("مشتری نمونه")).toBeVisible();
  await expect(page.getByText("۱۲,۰۰۰ تومان").first()).toBeVisible();
  await page.getByRole("button", { name: "ویرایش مشتری نمونه" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "ذخیره مشتری" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "شماره همراه تکراری است",
  );
  await page.getByRole("button", { name: "انصراف" }).click();
  await page.getByRole("button", { name: "افزودن مشتری" }).click();
  await page.getByRole("dialog").getByLabel("نام", { exact: true }).focus();
  await expect(
    page.getByRole("dialog").getByLabel("نام", { exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
