import { test, expect } from "@playwright/test";
test("map failure and reverse failure preserve manual address and chosen coordinates", async ({
  page,
}) => {
  let saved: Record<string, unknown> | null = null;
  await page.route("**/api/addresses/map", (route) =>
    route.fulfill({
      json: {
        map: {
          enabled: true,
          template: "https://tiles.invalid/{z}/{x}/{y}.png",
          attribution: "نمونه نقشه",
        },
        reverseEnabled: true,
      },
    }),
  );
  await page.route("https://tiles.invalid/**", (route) => route.abort());
  await page.route("**/api/addresses/reverse", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "نشانی‌یاب در دسترس نیست؛ دستی وارد کنید." },
    }),
  );
  await page.route("**/api/addresses", async (route) => {
    if (route.request().method() === "POST") {
      saved = route.request().postDataJSON();
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { items: [] } });
  });
  await page.goto("/address-test-probe");
  await page.getByRole("button", { name: "افزودن نشانی" }).click();
  const dialog = page.getByRole("dialog", { name: "افزودن نشانی" });
  await dialog.getByLabel("عنوان نشانی").fill("خانه");
  await dialog.getByLabel("نام گیرنده").fill("نام گیرنده");
  await dialog.getByLabel("شماره همراه گیرنده").fill("۰۹۱۲۳۴۵۶۷۸۹");
  await dialog.getByLabel("نشانی کامل").fill("نشانی دستی ویرایش شده");
  const map = dialog.getByRole("application");
  await expect(map).toBeVisible();
  await expect(dialog.getByText(/تصاویر نقشه در دسترس نیست/)).toBeVisible();
  await map.click({ position: { x: 100, y: 100 } });
  await dialog.getByText("ورود دستی مختصات").click();
  await expect(dialog.getByLabel("عرض جغرافیایی")).not.toHaveValue("");
  page.on("dialog", (d) => d.accept());
  await dialog.getByRole("button", { name: "پیشنهاد نشانی از مختصات" }).click();
  await expect(
    dialog.getByRole("status").filter({ hasText: "نشانی‌یاب در دسترس نیست" }),
  ).toBeVisible();
  await expect(dialog.getByLabel("نشانی کامل")).toHaveValue(
    "نشانی دستی ویرایش شده",
  );
  await dialog.getByRole("button", { name: "ذخیره نشانی" }).click();
  await expect(dialog).toBeHidden();
  expect(saved).not.toBeNull();
  const body = saved as unknown as {
    address: { coordinates: { lat: number; lng: number }; address: string };
  };
  expect(body.address.address).toBe("نشانی دستی ویرایش شده");
  expect(Number.isFinite(body.address.coordinates.lat)).toBeTruthy();
});

test("configured map renders tiles and attribution without contacting a live provider", async ({
  page,
}) => {
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  await page.route("**/api/addresses/map", (route) =>
    route.fulfill({
      json: {
        map: {
          enabled: true,
          template: "https://tiles.invalid/{z}/{x}/{y}.png",
          attribution: "نمونه نقشه",
        },
        reverseEnabled: false,
      },
    }),
  );
  await page.route("**/api/addresses", (route) =>
    route.fulfill({ json: { items: [] } }),
  );
  await page.route("https://tiles.invalid/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: png }),
  );
  await page.goto("/address-test-probe");
  await page.getByRole("button", { name: "افزودن نشانی" }).click();
  const dialog = page.getByRole("dialog", { name: "افزودن نشانی" });
  await expect(dialog.locator(".leaflet-tile-loaded").first()).toBeVisible();
  await expect(dialog.getByText("نمونه نقشه")).toBeVisible();
});
