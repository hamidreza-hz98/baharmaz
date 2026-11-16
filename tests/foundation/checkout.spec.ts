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
  await page.getByRole("button", { name: "تأیید نشانی" }).click();
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
  await page.getByRole("button", { name: "تأیید نشانی" }).click();
  await expect(page.getByRole("status")).toContainText(
    "نشانی دیگر در دسترس نیست",
  );
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("lamsechi-checkout-address"),
    ),
  ).toBeNull();
});

test("delivery quote shows server totals and rejects a changed quote", async ({
  page,
}) => {
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
  await page.getByRole("radio", { name: /خانه/ }).check();
  await page.getByRole("button", { name: "تأیید نشانی" }).click();
  await page.getByLabel("تاریخ تحویل (هجری شمسی)").selectOption("1404/01/01");
  await page.getByRole("radio", { name: /صبح/ }).check();
  await page.getByRole("button", { name: "محاسبه هزینه ارسال" }).click();
  await expect(page.getByText(/مبلغ نهایی: ۱۴۵,۰۰۰ تومان/)).toBeVisible();
  await page.getByRole("button", { name: "بررسی دوباره پیش‌فاکتور" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "سبد یا شرایط ارسال تغییر کرده" }),
  ).toBeVisible();
  await expect(page.getByText(/مبلغ نهایی:/)).toBeHidden();
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
  await page.getByRole("button", { name: "تأیید نشانی" }).click();
  await expect(
    page.getByText("این نشانی خارج از محدوده ارسال است."),
  ).toBeVisible();
  outside = false;
  await page.getByRole("button", { name: "تأیید نشانی" }).click();
  await expect(
    page.getByText("در حال حاضر زمان تحویلی در دسترس نیست."),
  ).toBeVisible();
});
