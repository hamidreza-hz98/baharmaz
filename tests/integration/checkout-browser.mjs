import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin = process.env.CHECKOUT_TEST_ORIGIN,
  token = process.env.CHECKOUT_CUSTOMER_TOKEN,
  executablePath = process.env.CATALOG_BROWSER_EXECUTABLE;
if (
  !origin ||
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin) ||
  !token ||
  !executablePath
)
  throw new Error("Isolated checkout browser configuration required.");
const browser = await chromium.launch({ executablePath, headless: true });
try {
  for (const [label, viewport] of [
    ["دسکتاپ", { width: 1280, height: 900 }],
    ["موبایل", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport, locale: "fa-IR" });
    try {
      await context.addCookies([
        {
          name: "lamsechi_customer_session",
          value: token,
          url: origin,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      await page.goto(`${origin}/cart`);
      await page.getByRole("heading", { name: "محصول نمونه" }).waitFor();
      const select = page.getByRole("button", { name: "انتخاب آدرس" });
      await select.waitFor();
      await select.click();
      await page.waitForURL("**/checkout/address");
      await page
        .getByRole("heading", { name: "انتخاب نشانی و زمان" })
        .waitFor();
      await page.getByRole("link", { name: "مدیریت و افزودن نشانی" }).click();
      await page.waitForURL("**/account/addresses");
      await page.getByRole("button", { name: "افزودن نشانی" }).click();
      const dialog = page.getByRole("dialog", { name: "افزودن نشانی" });
      await dialog.getByLabel("عنوان نشانی").fill(`خانه ${label}`);
      await dialog.getByLabel("نام گیرنده").fill("گیرنده نمونه");
      await dialog.getByLabel("شماره همراه گیرنده").fill("۰۹۱۲۳۴۵۶۷۸۹");
      await dialog.getByLabel("نشانی کامل").fill("تهران خیابان نمونه پلاک ۱۲");
      await dialog.getByRole("button", { name: "ذخیره نشانی" }).click();
      await dialog.waitFor({ state: "hidden" });
      await page.goto(`${origin}/checkout/address`);
      await page
        .getByRole("radio", { name: new RegExp(`خانه ${label}`) })
        .check();
      await page.getByText(/نشانی انتخاب شد/).waitFor();
      await page
        .getByText("قوانین و هزینه ارسال هنوز تنظیم نشده است.")
        .waitFor();
      await page.reload();
      await page
        .getByRole("radio", { name: new RegExp(`خانه ${label}`) })
        .waitFor();
      assert.equal(
        await page
          .getByRole("radio", { name: new RegExp(`خانه ${label}`) })
          .isChecked(),
        true,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      await page.goto(`${origin}/account`);
      await page.getByText("TEST-ORDER-1", { exact: false }).first().waitFor();
      await page
        .getByRole("link", { name: /جزئیات سفارش TEST-ORDER-1/ })
        .click();
      await page.getByText("نشانی زمان سفارش").waitFor();
      await page.getByText("نام زمان سفارش", { exact: false }).waitFor();
    } finally {
      await context.close();
    }
  }
  console.log("Real checkout handoff passed on desktop and mobile.");
} finally {
  await browser.close();
}
