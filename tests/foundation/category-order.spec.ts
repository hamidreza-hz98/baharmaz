import { expect, test } from "@playwright/test";

test("category order stays within sibling groups", async ({ page }) => {
  let items = [
    { id: "111111111111111111111111", name: "اصلی الف", parentId: null },
    { id: "222222222222222222222222", name: "اصلی ب", parentId: null },
    {
      id: "333333333333333333333333",
      name: "فرزند یک",
      parentId: "111111111111111111111111",
    },
    {
      id: "444444444444444444444444",
      name: "فرزند دو",
      parentId: "111111111111111111111111",
    },
    {
      id: "555555555555555555555555",
      name: "فرزند دیگر",
      parentId: "222222222222222222222222",
    },
  ];
  let moves = 0;
  await page.route("**/api/admin/catalog/**", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      moves++;
      const item = items.find((x) => x.id === body.id)!;
      items = items.filter((x) => x.id !== body.id);
      const index = items.findIndex((x) => x.id === body.target);
      items.splice(index + (body.placement === "after" ? 1 : 0), 0, item);
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({
      json: { items, revision: moves, total: items.length, page: 1, limit: 24 },
    });
  });
  await page.goto("/catalog-test-probe");
  await page.getByRole("button", { name: "ترتیب صفحه اصلی" }).click();
  const dialog = page.getByRole("dialog", { name: "ترتیب نمایش صفحه اصلی" });
  const first = dialog.getByRole("list", { name: "زیردسته‌های اصلی الف" });
  const second = dialog.getByRole("list", { name: "زیردسته‌های اصلی ب" });
  await expect(first.getByText("فرزند یک")).toBeVisible();
  await expect(second.getByText("فرزند دیگر")).toBeVisible();
  await expect(
    first.getByRole("button", { name: "انتقال فرزند یک به بالا" }),
  ).toBeDisabled();
  await expect(
    first.getByRole("button", { name: "انتقال فرزند دو به پایین" }),
  ).toBeDisabled();
  await first.getByRole("button", { name: "انتقال فرزند دو به بالا" }).click();
  await expect
    .poll(
      () =>
        items.findIndex((x) => x.name === "فرزند دو") <
        items.findIndex((x) => x.name === "فرزند یک"),
    )
    .toBe(true);
  const before = moves;
  await first
    .locator("[draggable=true]")
    .first()
    .dragTo(second.locator("[draggable=true]").first(), { force: true });
  expect(moves).toBe(before);
});
