import { expect, test } from "@playwright/test";

test("admin login handles keyboard entry, password visibility and rejected credentials", async ({
  page,
}) => {
  await page.route("**/api/admin/login", (route) =>
    route.fulfill({
      status: 401,
      json: { error: "نام کاربری یا رمز عبور درست نیست." },
    }),
  );
  await page.goto("/admin/login");
  const username = page.getByLabel("نام کاربری");
  const password = page.getByLabel("رمز عبور");
  await username.fill("admin");
  await password.fill("incorrect-password");
  await page.getByRole("button", { name: "نمایش" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "پنهان" }).click();
  await password.press("Enter");
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "نام کاربری یا رمز عبور درست نیست" }),
  ).toBeVisible();
});
