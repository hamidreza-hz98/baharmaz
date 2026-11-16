import { chromium } from "playwright";
import assert from "node:assert/strict";
const origin = process.env.CATALOG_TEST_ORIGIN;
const token = process.env.CATALOG_TEST_TOKEN;
const executablePath = process.env.CATALOG_BROWSER_EXECUTABLE;
if (
  !origin ||
  !token ||
  !executablePath ||
  !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
)
  throw new Error("Isolated browser test configuration required.");
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
          name: "lamsechi_admin_session",
          value: token,
          url: origin,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      const diagnostics = [];
      page.on("pageerror", (error) =>
        diagnostics.push(`pageerror: ${error.message}`),
      );
      page.on("console", (message) => {
        if (message.type() === "error")
          diagnostics.push(`console: ${message.text()}`);
      });
      page.on("requestfailed", (request) =>
        diagnostics.push(
          `requestfailed: ${new URL(request.url()).pathname} ${request.failure()?.errorText}`,
        ),
      );
      page.on("response", (response) => {
        if (
          response.status() >= 400 ||
          response.url().includes("_next/static") ||
          response.url().includes("/api/admin/catalog")
        )
          diagnostics.push(
            `HTTP ${response.status()}: ${new URL(response.url()).pathname}`,
          );
      });
      await page.goto(`${origin}/admin/categories`);
      try {
        await page
          .getByRole("button", { name: "ویرایش خوراک" })
          .waitFor({ timeout: 30000 });
      } catch (error) {
        console.error(
          "Catalog page diagnostic:",
          page.url(),
          (await page.locator("body").innerText()).slice(0, 1500),
          diagnostics,
        );
        throw error;
      }
      await page.getByRole("button", { name: "افزودن دسته‌بندی" }).click();
      await page
        .getByRole("textbox", { name: "نام دسته‌بندی" })
        .fill(`نمونه ${label}`);
      await page
        .getByRole("button", { name: "انتخاب تصویر", exact: true })
        .click();
      const picker = page.getByRole("dialog", { name: "انتخاب رسانه" });
      await picker
        .getByRole("button", { name: "انتخاب رسانه", exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: "ذخیره", exact: true }).click();
      await page.getByText(`نمونه ${label}`, { exact: true }).waitFor();
      await page.getByRole("button", { name: "ترتیب صفحه اصلی" }).click();
      const order = page.getByRole("dialog", { name: "ترتیب نمایش صفحه اصلی" });
      const move = order.getByRole("button", {
        name: `انتقال نمونه ${label} به بالا`,
      });
      await move.focus();
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/admin/catalog/categories") &&
            response.request().method() === "POST" &&
            response.status() === 200,
        ),
        page.keyboard.press("Enter"),
      ]);
      await order.getByRole("button", { name: "بستن" }).click();
      await page.goto(`${origin}/admin/ingredients`);
      await page.getByRole("button", { name: "ویرایش پنیر" }).waitFor();
      await page.getByRole("button", { name: "افزودن ماده اولیه" }).click();
      await page
        .getByRole("textbox", { name: "نام ماده اولیه" })
        .fill(`ماده ${label}`);
      await page.getByRole("button", { name: "انتخاب آیکون" }).click();
      await page
        .getByRole("dialog", { name: "انتخاب رسانه" })
        .getByRole("button", { name: "انتخاب رسانه", exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: "ذخیره", exact: true }).click();
      await page.getByText(`ماده ${label}`, { exact: true }).waitFor();
      await page.getByRole("button", { name: `بایگانی ماده ${label}` }).click();
      await page
        .getByRole("dialog", { name: "بایگانی ماده اولیه" })
        .getByRole("button", { name: "بایگانی", exact: true })
        .click();
      await page
        .getByText(`ماده ${label}`, { exact: true })
        .waitFor({ state: "hidden" });
      await page.goto(`${origin}/admin/products/new`);
      await page
        .getByRole("textbox", { name: "نام محصول" })
        .fill(`محصول ${label}`);
      await page.getByRole("radio", { name: "خوراک" }).check();
      await page.getByRole("checkbox", { name: "پنیر" }).check();
      await page.getByLabel("قیمت اصلی (تومان)").fill("۲۵۰۰۰۰");
      await page.getByRole("button", { name: "افزودن تصویر" }).click();
      await page
        .getByRole("dialog", { name: "انتخاب رسانه" })
        .getByRole("button", { name: "انتخاب رسانه", exact: true })
        .first()
        .click();
      await page.getByRole("button", { name: "ذخیره محصول" }).click();
      await page.waitForURL("**/admin/products");
      await page
        .getByRole("button", { name: `ویرایش قیمت محصول ${label}` })
        .click();
      const priceDialog = page.getByRole("dialog", { name: /ویرایش قیمت/ });
      await priceDialog.getByLabel("قیمت اصلی (تومان)").fill("۳۰۰۰۰۰");
      await priceDialog.getByRole("button", { name: "ذخیره قیمت" }).click();
      await priceDialog.waitFor({ state: "hidden" });
      await page.goto(`${origin}/products`);
      const publicProduct = page.getByRole("link", {
        name: new RegExp(`محصول ${label}`),
      });
      await publicProduct.waitFor();
      await publicProduct.click();
      await page.waitForURL(/\/products\/.+/);
      try {
        await page
          .getByRole("heading", { name: `محصول ${label}`, level: 1 })
          .waitFor({ timeout: 10000 });
      } catch (error) {
        console.error(
          "Public product diagnostic",
          page.url(),
          (await page.locator("body").innerText()).slice(0, 1200),
          diagnostics,
        );
        throw error;
      }
      assert.match(await page.title(), /بهارمز/);
      await page.getByRole("button", { name: "افزودن به سبد خرید" }).click();
      await page.getByText("به سبد خرید اضافه شد.").waitFor();
      await page.goto(`${origin}/cart`);
      await page.getByRole("heading", { name: `محصول ${label}` }).waitFor();
      await page
        .getByRole("button", { name: `افزایش تعداد محصول ${label}` })
        .click();
      await page
        .getByLabel(`تعداد محصول ${label}`, { exact: true })
        .getByText("۲", { exact: true })
        .waitFor();
      await page.reload();
      await page
        .getByLabel(`تعداد محصول ${label}`, { exact: true })
        .getByText("۲", { exact: true })
        .waitFor();
      await page.goBack();
      await page.waitForURL(/\/products\/.+/);
      await page.getByRole("link", { name: "خوراک" }).click();
      await page.waitForURL(/\/categories\/.+/);
      await page.waitForFunction(() => document.title.includes("خوراک"));
      assert.match(await page.title(), /خوراک/);
      await page.goto(`${origin}/products/does-not-exist`);
      await page.getByRole("heading", { name: "صفحه پیدا نشد" }).waitFor();
      await page.goto(`${origin}/`);
      await page.getByRole("heading", { name: "دسته‌بندی محصولات" }).waitFor();
      await page.getByText("طعم تازه بهارمز").waitFor();
      await page.goto(`${origin}/faq`);
      await page.getByText("پرسش اول", { exact: true }).click();
      await page.getByText("پاسخ", { exact: true }).waitFor();
      await page.goto(`${origin}/about`);
      assert.match(await page.title(), /درباره بهارمز/);
      await page.goto(`${origin}/contact`);
      await page.getByLabel("نام و نام خانوادگی").fill("مشتری نمونه");
      await page
        .getByLabel("شماره همراه")
        .fill(label === "دسکتاپ" ? "۰۹۱۲۰۰۰۰۰۰۱" : "۰۹۱۲۰۰۰۰۰۰۲");
      await page.getByLabel("متن پیام").fill("سلام، پیام آزمایشی فروشگاه");
      await page.getByRole("button", { name: "ثبت پیام" }).click();
      await page
        .getByText("پیام شما ثبت شد و برای بررسی در دسترس فروشگاه است.")
        .waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
    } finally {
      await context.close();
    }
  }
  console.log(
    "Real catalog and product browser tests passed on desktop and mobile.",
  );
} finally {
  await browser.close();
}
