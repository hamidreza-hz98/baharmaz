import { expect, test } from "@playwright/test";

test("account forms and session controls respond on desktop and mobile", async ({
  page,
}) => {
  await page.route("**/api/account", async (route) => {
    const body = route.request().postDataJSON?.();
    if (route.request().method() === "GET" || body?.action === "profile")
      return route.fulfill({
        json: {
          profile: {
            name: "کاربر نمونه",
            mobile: "09120000000",
            birthdate: "1399/12/30",
          },
        },
      });
    if (body?.action === "verify-new")
      return route.fulfill({
        json: {
          ok: true,
          profile: {
            name: "کاربر نمونه",
            mobile: "09120000001",
            birthdate: "1399/12/30",
          },
        },
      });
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/admin/account", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: {
          profile: {
            name: "مدیر نمونه",
            username: "admin",
            mobile: "09120000000",
          },
          sessions: [
            {
              id: "123",
              current: false,
              createdAt: "2026-11-09T10:00:00Z",
              expiresAt: "2026-12-09T10:00:00Z",
            },
          ],
        },
      });
    return route.fulfill({ json: { ok: true, current: false } });
  });
  await page.goto("/account-test-probe");
  await expect(
    page.getByRole("heading", { name: "اطلاعات شخصی" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "تغییر شماره همراه" }).click();
  await page.getByLabel("کد چهار رقمی").fill("۱۲۳۴");
  await page.getByRole("button", { name: "تأیید", exact: true }).click();
  await page
    .getByRole("textbox", { name: "شماره همراه جدید" })
    .fill("09120000001");
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await page.getByLabel("کد چهار رقمی").fill("۵۶۷۸");
  await page.getByRole("button", { name: "تأیید", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "شماره همراه تغییر کرد." }),
  ).toBeVisible();
  await expect(page.getByText("09120000001")).toBeVisible();
  await page.getByRole("button", { name: "پایان نشست" }).click();
  await expect(page.getByText("نشست پایان یافت.")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("profile navigation and failed logout keep the session visible", async ({
  page,
}) => {
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        profile: {
          name: "کاربر نمونه",
          mobile: "09120000000",
          birthdate: null,
        },
      },
    }),
  );
  await page.route("**/api/admin/account", (route) =>
    route.fulfill({
      json: {
        profile: { name: "مدیر", username: "admin", mobile: "" },
        sessions: [],
      },
    }),
  );
  await page.route("**/api/account/logout", (route) =>
    route.fulfill({ status: 503, json: { error: "خروج ممکن نشد" } }),
  );
  await page.goto("/account-test-probe");
  const nav = page.getByRole("navigation", { name: "منوی حساب کاربری" });
  await expect(nav.getByRole("link", { name: "سفارش‌های من" })).toHaveAttribute(
    "href",
    "/account",
  );
  await expect(nav.getByRole("link", { name: "نشانی‌های من" })).toHaveAttribute(
    "href",
    "/account/addresses",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "خروج از حساب" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "خروج از حساب ممکن نشد" }),
  ).toBeVisible();
  await expect(nav).toBeVisible();
});
