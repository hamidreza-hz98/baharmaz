import { test, expect } from "@playwright/test";
test("address handoff chooses a customer address and preserves selection on refresh", async ({
  page,
}) => {
  await page.route("**/api/delivery", (route) =>
    route.fulfill({ json: { status: "not_configured", days: [] } }),
  );
  await page.route("**/api/addresses", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "aaaaaaaaaaaaaaaaaaaaaaaa",
            label: "خانه",
            address: "نشانی نمونه",
            recipient: "گیرنده",
            mobile: "09123456789",
          },
        ],
      },
    }),
  );
  await page.goto("/checkout-test-probe");
  await page.getByRole("radio", { name: /خانه/ }).check();
  await expect(
    page.getByRole("status").filter({ hasText: "نشانی انتخاب شد" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: /خانه/ })).toBeChecked();
  await expect(
    page
      .getByRole("navigation", { name: "مراحل خرید" })
      .getByText("نشانی و زمان"),
  ).toHaveAttribute("aria-current", "step");
});

test("a deleted address cannot be confirmed from an old list", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/addresses", (route) => {
    calls++;
    return route.fulfill({
      json: {
        items:
          calls === 1
            ? [
                {
                  id: "aaaaaaaaaaaaaaaaaaaaaaaa",
                  label: "خانه",
                  address: "نشانی نمونه",
                  recipient: "گیرنده",
                  mobile: "09123456789",
                },
              ]
            : [],
      },
    });
  });
  await page.goto("/checkout-test-probe");
  await page.getByRole("radio", { name: /خانه/ }).check();
  await expect(
    page.getByRole("status").filter({ hasText: "نشانی دیگر در دسترس نیست" }),
  ).toContainText("نشانی دیگر در دسترس نیست");
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("lamsechi-checkout-address"),
    ),
  ).toBeNull();
});

test("delivery quote shows server totals and rejects a changed quote", async ({
  page,
}) => {
  await page.route("**/api/cart", (route) =>
    route.fulfill({
      json: {
        subtotalRials: 1000000,
        discountRials: 0,
        itemsTotalRials: 1000000,
      },
    }),
  );
  await page.route("**/api/addresses", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "aaaaaaaaaaaaaaaaaaaaaaaa",
            label: "خانه",
            address: "نشانی نمونه",
            recipient: "گیرنده",
            mobile: "09123456789",
          },
        ],
      },
    }),
  );
  await page.route("**/api/delivery", (route) => {
    const request = route.request().postDataJSON();
    if (request.action === "options")
      return route.fulfill({
        json: {
          status: "covered",
          zone: { id: "z", name: "نمونه" },
          days: [
            {
              date: "1404/01/01",
              label: "جمعه ۱ فروردین",
              slots: [
                {
                  id: "s",
                  label: "صبح",
                  start: "10:00",
                  end: "12:00",
                  available: true,
                  reason: null,
                },
              ],
            },
          ],
        },
      });
    if (request.action === "quote")
      return route.fulfill({
        json: {
          token: "token",
          date: "1404/01/01",
          slot: { id: "s" },
          zone: "نمونه",
          shippingRials: 450000,
          itemsTotalRials: 1000000,
          totalRials: 1450000,
          expiresAt: new Date(Date.now() + 60000).toISOString(),
        },
      });
    return route.fulfill({
      status: 409,
      json: { error: "سبد یا شرایط ارسال تغییر کرده است؛ دوباره بررسی کنید." },
    });
  });
  await page.goto("/checkout-test-probe");
  const summary = page.getByRole("region", { name: "خلاصه سبد خرید" });
  await expect(summary.locator(".price-total")).toContainText("۱۰۰,۰۰۰ تومان");
  await expect(summary).toContainText("بدون هزینه ارسال");
  await expect(summary.getByText("جمع پس از تخفیف")).toHaveCount(0);
  await page.getByRole("radio", { name: /خانه/ }).check();
  await page.getByLabel("تاریخ تحویل (هجری شمسی)").click();
  await page.getByRole("option", { name: "جمعه ۱ فروردین" }).click();
  await page.getByRole("radio", { name: /صبح/ }).check();
  await expect(page.getByText("۱۴۵,۰۰۰ تومان")).toBeVisible();
  await page.getByRole("button", { name: "مرحله بعد" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "سبد یا شرایط ارسال تغییر کرده" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "مرحله بعد" })).toBeDisabled();
});

test("delivery shows out-of-area and no-slots states", async ({ page }) => {
  let outside = true;
  await page.route("**/api/addresses", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: "aaaaaaaaaaaaaaaaaaaaaaaa",
            label: "خانه",
            address: "نشانی نمونه",
            recipient: "گیرنده",
            mobile: "09123456789",
          },
        ],
      },
    }),
  );
  await page.route("**/api/delivery", (route) =>
    route.fulfill({
      json: outside
        ? { status: "outside", days: [] }
        : {
            status: "covered",
            days: [{ date: "1404/01/01", label: "جمعه", slots: [] }],
          },
    }),
  );
  await page.goto("/checkout-test-probe");
  await page.getByRole("radio", { name: /خانه/ }).check();
  await expect(
    page.getByText("این نشانی خارج از محدوده ارسال است."),
  ).toBeVisible();
  outside = false;
  await page.getByRole("button", { name: "بررسی دوباره" }).click();
  await expect(
    page.getByText("در حال حاضر زمان تحویلی در دسترس نیست."),
  ).toBeVisible();
});
