import { expect, test } from "@playwright/test";
import { shopIntroduction } from "../fixtures/shop";

test.beforeEach(async ({ page }) => {
  // No external provider is contacted by browser tests.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
      await route.abort();
    } else {
      await route.continue();
    }
  });
});

test("Persian storefront renders in RTL and returns its public contract", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(
    page.getByRole("heading", { name: shopIntroduction.name, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText(shopIntroduction.message)).toBeVisible();
  const response = await page.request.get("/api/shop");
  expect(response.ok()).toBeTruthy();
  expect(await response.json()).toEqual({ ok: true, data: shopIntroduction });
});

test("navigation, protected admin routes and not-found are safe", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  if (testInfo.project.name === "mobile-chromium") {
    const trigger = page.getByRole("button", { name: "باز کردن منوی فروشگاه" });
    await expect(trigger).toBeEnabled();
    await trigger.press("Enter");
    const drawer = page.getByRole("dialog", { name: "منوی فروشگاه" });
    await expect(drawer.getByRole("link", { name: "خانه" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  } else {
    await expect(
      page
        .getByRole("navigation", { name: "منوی اصلی" })
        .getByRole("link", { name: "خانه" }),
    ).toHaveAttribute("aria-current", "page");
  }
  await page.goto("/admin/orders");
  await page.waitForURL("**/admin/login");
  await expect(
    page.getByRole("heading", { name: "ورود به پنل مدیریت" }),
  ).toBeVisible();
  await expect(page.getByText("سفارش‌های اخیر")).toHaveCount(0);
  await page.goto("/missing-e2e-page");
  await expect(
    page.getByRole("heading", { name: "صفحه پیدا نشد" }),
  ).toBeVisible();
  await expect(page.getByText("مدیریت بهارمز")).toHaveCount(0);
  await page.getByRole("link", { name: "بازگشت به صفحه اصلی" }).click();
  await expect(
    page.getByRole("heading", { name: shopIntroduction.name, level: 1 }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("OTP registration dialog keeps the current checkout context", async ({
  page,
}) => {
  await page.goto("/?checkout=address");
  await page.route("**/api/auth/otp", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "send") await route.fulfill({ json: { ok: true } });
    else if (body.action === "verify")
      await route.fulfill({ json: { ok: true, next: "registration" } });
    else await route.fulfill({ json: { ok: true, next: "complete" } });
  });
  await page.getByRole("button", { name: "ورود / ثبت‌نام" }).click();
  await page.getByLabel("شماره همراه").fill("۰۹۱۲۰۰۰۰۰۰۰");
  await page.getByRole("button", { name: "دریافت کد" }).click();
  await page.getByLabel("رقم 1 کد تأیید").fill("۱");
  await page.getByLabel("رقم 2 کد تأیید").fill("۲");
  await page.getByLabel("رقم 3 کد تأیید").fill("۳");
  await page.getByLabel("رقم 4 کد تأیید").fill("۴");
  await page.getByRole("button", { name: "تأیید", exact: true }).click();
  await page.getByLabel("نام", { exact: true }).fill("کاربر");
  await page.getByLabel("نام خانوادگی").fill("نمونه");
  await page
    .locator('input[autocomplete="new-password"]')
    .first()
    .fill("a-long-test-password");
  await page.getByLabel("تکرار رمز عبور").fill("a-long-test-password");
  await page.getByRole("button", { name: "تکمیل ثبت‌نام" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  expect(new URL(page.url()).searchParams.get("checkout")).toBe("address");
});

test("informational empty states and contact failure retain input", async ({
  page,
}) => {
  await page.goto("/faq");
  await expect(page.getByText("هنوز پرسشی ثبت نشده است.")).toBeVisible();
  await page.goto("/terms");
  await expect(
    page.getByText("قوانین و شرایط هنوز ثبت نشده است."),
  ).toBeVisible();
  await page.route("**/api/contact", (route) =>
    route.fulfill({
      status: 503,
      json: { message: "ثبت پیام ممکن نشد؛ دوباره تلاش کنید." },
    }),
  );
  await page.goto("/contact");
  await page.getByLabel("نام و نام خانوادگی").fill("کاربر نمونه");
  await page.getByLabel("شماره همراه").fill("۰۹۱۲۰۰۰۰۰۰۰");
  await page.getByLabel("متن پیام").fill("پیام آزمایشی برای فروشگاه");
  await page.getByRole("button", { name: "ثبت پیام" }).click();
  await expect(page.getByRole("status")).toContainText("ثبت پیام ممکن نشد");
  await expect(page.getByLabel("متن پیام")).toHaveValue(
    "پیام آزمایشی برای فروشگاه",
  );
  await expect(page.getByRole("contentinfo")).toBeVisible();
});
