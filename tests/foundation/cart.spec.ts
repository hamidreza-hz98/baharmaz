import { test, expect } from "@playwright/test";
test("cart imports old draft, displays changed prices and updates quantity", async ({
  page,
}) => {
  const id = "aaaaaaaaaaaaaaaaaaaaaaaa";
  let qty = 1,
    changed = true;
  await page.route("**/api/account", (route) =>
    route.fulfill({ status: 401, json: { error: "ورود لازم است" } }),
  );
  const actions: string[] = [];
  const state = () => ({
    items: qty
      ? [
          {
            productId: id,
            title: "محصول نمونه",
            quantity: qty,
            status: "available",
            priceChanged: changed,
            quantityCapped: false,
            regularRials: 1200000,
            saleRials: 900000,
            lineRials: 900000 * qty,
          },
        ]
      : [],
    subtotalRials: 1200000 * qty,
    discountRials: 300000 * qty,
    itemsTotalRials: 900000 * qty,
    shippingRials: null,
    totalRials: null,
  });
  await page.addInitScript(
    ([id]) =>
      localStorage.setItem(
        "lamsechi-cart-draft-v1",
        JSON.stringify({ [id]: 1 }),
      ),
    [id],
  );
  await page.route("**/api/cart", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      actions.push(body.action);
      if (body.action === "acknowledge") changed = false;
      if (body.action === "set") qty = body.quantity;
      if (body.action === "remove") qty = 0;
    }
    await route.fulfill({ json: state() });
  });
  await page.goto("/cart-test-probe");
  await expect(page.getByText("قیمت محصول تغییر کرده است.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "انتخاب آدرس" }),
  ).toBeDisabled();
  expect(actions).toContain("import");
  expect(
    await page.evaluate(() => localStorage.getItem("lamsechi-cart-draft-v1")),
  ).toBeNull();
  await page.getByRole("button", { name: "تأیید قیمت جدید" }).click();
  await expect(page.getByText("قیمت محصول تغییر کرده است.")).toBeHidden();
  await page.getByRole("button", { name: "انتخاب آدرس" }).click();
  const login = page.getByRole("dialog", { name: "ورود یا ثبت‌نام" });
  await expect(login).toBeVisible();
  await login.getByRole("button", { name: "انصراف" }).click();
  await expect(login).toBeHidden();
  await page.getByRole("button", { name: "افزایش تعداد محصول نمونه" }).click();
  await expect(
    page
      .getByLabel("تعداد محصول نمونه", { exact: true })
      .getByText("۲", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(/مبلغ نمایش‌داده‌شده بدون هزینه ارسال است/),
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "حذف محصول نمونه" }).click();
  await expect(page.getByText(/سبد خرید شما خالی است/)).toBeVisible();
});

test("unavailable items block address handoff and failed updates keep the cart", async ({
  page,
}) => {
  const id = "bbbbbbbbbbbbbbbbbbbbbbbb";
  const data = {
    items: [
      {
        productId: id,
        title: "کالای ناموجود",
        quantity: 1,
        status: "unavailable",
        priceChanged: false,
        quantityCapped: false,
        regularRials: null,
        saleRials: null,
        lineRials: null,
      },
    ],
    subtotalRials: 0,
    discountRials: 0,
    itemsTotalRials: 0,
    shippingRials: null,
    totalRials: null,
  };
  await page.route("**/api/account", (route) =>
    route.fulfill({ status: 401, json: { error: "ورود لازم است" } }),
  );
  await page.route("**/api/cart", (route) => {
    const request = route.request();
    if (
      request.method() === "POST" &&
      request.postDataJSON().action === "remove"
    )
      return route.fulfill({ status: 503, json: { error: "حذف ممکن نشد" } });
    return route.fulfill({ json: data });
  });
  await page.goto("/cart-test-probe");
  await expect(page.getByText(/این محصول ناموجود است/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "انتخاب آدرس" }),
  ).toBeDisabled();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "حذف کالای ناموجود" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "حذف ممکن نشد" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "کالای ناموجود" }),
  ).toBeVisible();
});

test("sign-in preserves the cart and rechecks changed prices before address selection", async ({
  page,
}) => {
  let signed = false;
  const data = () => ({
    items: [
      {
        productId: "cccccccccccccccccccccccc",
        title: "غذای نمونه",
        quantity: 1,
        status: "available",
        priceChanged: signed,
        quantityCapped: false,
        regularRials: 100000,
        saleRials: 100000,
        lineRials: 100000,
      },
    ],
    subtotalRials: 100000,
    discountRials: 0,
    itemsTotalRials: 100000,
    shippingRials: null,
    totalRials: null,
  });
  await page.route("**/api/account", (route) =>
    route.fulfill({
      status: signed ? 200 : 401,
      json: signed
        ? { profile: { name: "کاربر" } }
        : { error: "ورود لازم است" },
    }),
  );
  await page.route("**/api/cart", (route) => route.fulfill({ json: data() }));
  await page.route("**/api/auth/otp", (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "verify") signed = true;
    return route.fulfill({
      json:
        body.action === "verify"
          ? { ok: true, next: "complete" }
          : { ok: true },
    });
  });
  await page.goto("/cart-test-probe");
  await page.getByRole("button", { name: "انتخاب آدرس" }).click();
  const login = page.getByRole("dialog", { name: "ورود یا ثبت‌نام" });
  await login.getByLabel("شماره همراه").fill("۰۹۱۲۳۴۵۶۷۸۹");
  await login.getByRole("button", { name: "دریافت کد" }).click();
  await page.getByLabel("رقم 1 کد تأیید").fill("۱");
  await page.getByLabel("رقم 2 کد تأیید").fill("۲");
  await page.getByLabel("رقم 3 کد تأیید").fill("۳");
  await page.getByLabel("رقم 4 کد تأیید").fill("۴");
  await page.getByRole("button", { name: "تأیید", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "سبد تغییر کرده است" }),
  ).toBeVisible();
  await expect(page.getByText("قیمت محصول تغییر کرده است.")).toBeVisible();
  expect(page.url()).toContain("/cart-test-probe");
});
