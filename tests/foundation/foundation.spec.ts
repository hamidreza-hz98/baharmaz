import { expect, test } from "@playwright/test";

test("SSR styles, RTL, keyboard dialog and accessible states work", async ({
  page,
  request,
}) => {
  const response = await request.get("/foundation-test-probe");
  expect(response.ok()).toBeTruthy();
  const html = await response.text();
  expect(html).toContain('data-emotion="muirtl');
  expect(html.indexOf('data-emotion="muirtl')).toBeLessThan(
    html.indexOf("</head>"),
  );
  const errors: string[] = [];
  await page.route("**/api/catalog/media/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a5sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/foundation-test-probe");
  await expect(page.getByLabel("نام", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "در حال بارگذاری" }),
  ).toBeVisible();
  await expect(page.locator("bdi")).toHaveAttribute("dir", "ltr");
  await expect(page.getByRole("img", { name: "بنر خوراک" })).toHaveAttribute(
    "loading",
    "eager",
  );
  await expect(page.getByRole("img", { name: "محصول نمونه" })).toHaveAttribute(
    "fetchpriority",
    "high",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  const trigger = page.getByRole("button", { name: "باز کردن پنجره" });
  const dimensions = await trigger.boundingBox();
  expect(dimensions?.height).toBeGreaterThanOrEqual(44);
  const colors = await trigger.evaluate((element) => {
    const css = getComputedStyle(element);
    return [css.color, css.backgroundColor];
  });
  const luminance = (color: string) => {
    const channels = color
      .match(/\d+/g)!
      .slice(0, 3)
      .map(Number)
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const [a, b] = colors.map(luminance).sort((x, y) => y - x);
  expect((a + 0.05) / (b + 0.05)).toBeGreaterThanOrEqual(4.5);
  await trigger.focus();
  await expect(trigger).toBeFocused();
  expect(
    await trigger.evaluate((element) => getComputedStyle(element).outlineStyle),
  ).not.toBe("none");
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "ویرایش اطلاعات" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("نام گیرنده")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(
    errors.filter((message) =>
      /hydration|did not match|server rendered|error/i.test(message),
    ),
  ).toEqual([]);
});

test("admin shell navigation and recoverable state work", async ({
  page,
}, testInfo) => {
  await page.goto("/foundation-test-probe");
  await page.getByRole("button", { name: "تلاش دوباره" }).click();
  await expect(page.getByText("بازیابی شد")).toBeVisible();
  if (testInfo.project.name !== "desktop") {
    const trigger = page.getByRole("button", { name: "باز کردن منوی مدیریت" });
    const size = await trigger.boundingBox();
    expect(size?.width).toBeGreaterThanOrEqual(44);
    expect(size?.height).toBeGreaterThanOrEqual(44);
    await trigger.focus();
    await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog", { name: "منوی مدیریت" });
    await expect(
      drawer.getByRole("link", { name: "سفارش‌ها" }),
    ).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  } else {
    await expect(page.getByRole("link", { name: "سفارش‌ها" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  }
  const profile = page.locator("#admin-profile-trigger");
  await expect(profile).toHaveAccessibleName("منوی حساب مدیر");
  await profile.focus();
  await page.keyboard.press("Enter");
  await expect(profile).toHaveAttribute("aria-expanded", "true");
  const menu = page.getByRole("menu", { name: "منوی حساب مدیر" });
  await expect(
    menu.getByRole("menuitem", { name: "اطلاعات حساب و نشست‌ها" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(profile).toBeFocused();
});
