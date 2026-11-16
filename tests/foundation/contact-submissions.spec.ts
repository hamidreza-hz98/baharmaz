import { expect, test } from "@playwright/test";
test("contact messages render hostile markup as text and recover from errors", async ({
  page,
}) => {
  const markup =
    '<img src=x onerror="window.contactXss=1">\n<script>window.contactXss=2</script>';
  const item = {
    id: "123456789012345678901234",
    name: "<svg onload=alert(1)>",
    mobile: "09120000000",
    message: markup,
    createdAt: "2026-11-11T12:00:00Z",
  };
  let failList = true,
    failDetail = true;
  await page.route("**/api/admin/contact-submissions?*", (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.has("id"))
      return failDetail
        ? route.fulfill({ status: 503, json: {} })
        : route.fulfill({ json: { item } });
    if (failList) return route.fulfill({ status: 503, json: {} });
    if (params.get("q"))
      return route.fulfill({
        json: { items: [], total: 0, page: 1, limit: 20 },
      });
    return route.fulfill({
      json: { items: [item], total: 1, page: 1, limit: 20 },
    });
  });
  await page.goto("/contact-submissions-test-probe");
  await expect(
    page.getByRole("alert").filter({ hasText: "دریافت پیام‌ها ممکن نشد" }),
  ).toBeVisible();
  failList = false;
  await page.getByRole("button", { name: "تلاش دوباره" }).click();
  await expect(page.getByText(markup)).toBeVisible();
  await page.getByRole("button", { name: /مشاهده پیام/ }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "دریافت جزئیات ممکن نشد",
  );
  failDetail = false;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "تلاش دوباره" })
    .click();
  await expect(page.getByRole("dialog").getByText(markup)).toBeVisible();
  expect(
    await page.evaluate(
      () => (window as unknown as { contactXss?: number }).contactXss,
    ),
  ).toBeUndefined();
  await expect(page.getByRole("dialog").locator("img,script,svg")).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await page
    .getByRole("searchbox", { name: "جست‌وجوی نام، شماره یا متن" })
    .fill("غایب");
  await expect(page.getByText("پیامی با این جست‌وجو پیدا نشد.")).toBeVisible();
});
