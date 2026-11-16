import { expect, test } from "@playwright/test";

test("category ordering, media selection and ingredient editing work", async ({
  page,
}) => {
  let categories: {
    id: string;
    name: string;
    slug: string;
    parentId?: string | null;
    parentName?: string | null;
  }[] = [
    { id: "111111111111111111111111", name: "سالاد", slug: "salad" },
    { id: "222222222222222222222222", name: "خوراک", slug: "food" },
  ];
  let ingredients: { id: string; name: string; iconId: string }[] = [];
  let revision = 0;
  let conflict = false;
  await page.route("**/api/admin/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === "/api/admin/media")
      return route.fulfill({
        json: {
          items: [
            {
              id: "aaaaaaaaaaaaaaaaaaaaaaaa",
              filename: "آیکون.webp",
              length: 12,
              uploadedAt: "2026-11-09T10:00:00Z",
              kind: "image",
              contentType: "image/webp",
              width: 20,
              height: 20,
            },
          ],
          page: 1,
          limit: 24,
          total: 1,
        },
      });
    if (!url.pathname.includes("/catalog/")) return route.abort();
    const isCategory = url.pathname.endsWith("categories");
    if (req.method() === "GET") {
      if (url.searchParams.get("order") === "all")
        return route.fulfill({ json: { items: categories, revision } });
      const list = isCategory ? categories : ingredients;
      const q = url.searchParams.get("q") ?? "";
      const items = list.filter((item) => item.name.includes(q));
      return route.fulfill({
        json: { items, revision, total: items.length, page: 1, limit: 24 },
      });
    }
    const body = req.postDataJSON();
    if (body.action === "move") {
      if (conflict) {
        conflict = false;
        return route.fulfill({
          status: 409,
          json: { error: "ترتیب تغییر کرده است." },
        });
      }
      const item = categories.find((entry) => entry.id === body.id)!;
      categories = categories.filter((entry) => entry.id !== body.id);
      const target = categories.findIndex((entry) => entry.id === body.target);
      categories.splice(target + (body.placement === "after" ? 1 : 0), 0, item);
      revision++;
      return route.fulfill({ json: { ok: true } });
    }
    if (body.action === "create") {
      if (isCategory)
        categories.push({
          id: String(categories.length + 3).repeat(24),
          name: body.name,
          slug: "new",
          parentId: body.parentId,
          parentName:
            categories.find((item) => item.id === body.parentId)?.name ?? null,
        });
      else
        ingredients.push({
          id: "444444444444444444444444",
          name: body.name,
          iconId: body.iconId,
        });
      return route.fulfill({ status: 201, json: { item: {} } });
    }
    if (body.action === "archive") {
      if (isCategory)
        categories = categories.filter((item) => item.id !== body.id);
      else ingredients = ingredients.filter((item) => item.id !== body.id);
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ json: { item: {} } });
  });
  await page.goto("/catalog-test-probe");
  await expect(
    page.getByRole("heading", { name: "دسته‌بندی‌ها" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "ترتیب صفحه اصلی" }).click();
  const order = page.getByRole("dialog", { name: "ترتیب نمایش صفحه اصلی" });
  await order.getByRole("button", { name: "انتقال خوراک به بالا" }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => categories[0].name).toBe("خوراک");
  conflict = true;
  await order.getByRole("button", { name: "انتقال خوراک به پایین" }).click();
  await expect(order.getByText("ترتیب تغییر کرده است.")).toBeVisible();
  await order.getByRole("button", { name: "تازه‌سازی" }).click();
  await expect(order.getByText("ترتیب تغییر کرده است.")).toHaveCount(0);
  const rows = order.locator("[draggable=true]");
  const targetSize = await rows.last().boundingBox();
  expect(targetSize).not.toBeNull();
  await rows.first().dragTo(rows.last(), {
    targetPosition: { x: 20, y: targetSize!.height - 4 },
  });
  await expect.poll(() => categories[0].name).toBe("سالاد");
  await order.getByRole("button", { name: "بستن" }).click();
  await page.getByRole("button", { name: "افزودن دسته‌بندی" }).click();
  await page.getByRole("textbox", { name: "نام دسته‌بندی" }).fill("پیش غذا");
  await page.getByRole("button", { name: "انتخاب تصویر", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "انتخاب رسانه" });
  await picker
    .getByRole("button", { name: "انتخاب رسانه", exact: true })
    .click();
  await expect(page.getByText("تصویر انتخاب شد")).toBeVisible();
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await expect(page.getByText("پیش غذا")).toBeVisible();
  await page.getByRole("button", { name: "افزودن زیردسته به سالاد" }).click();
  await page.getByRole("textbox", { name: "نام دسته‌بندی" }).fill("سالاد ویژه");
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await expect(page.getByText("دسته اصلی: سالاد")).toBeVisible();
  expect(categories.at(-1)?.parentId).toBe("111111111111111111111111");
  await page.getByRole("button", { name: "افزودن زیردسته به سالاد" }).click();
  await page.getByRole("textbox", { name: "نام دسته‌بندی" }).fill("سالاد فصل");
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await page.getByRole("button", { name: "ترتیب صفحه اصلی" }).click();
  const childList = order.getByRole("list", { name: "زیردسته‌های سالاد" });
  await expect(childList.getByText("سالاد ویژه")).toBeVisible();
  await expect(
    childList.getByRole("button", { name: "انتقال سالاد ویژه به بالا" }),
  ).toBeDisabled();
  await expect(
    childList.getByRole("button", { name: "انتقال سالاد فصل به پایین" }),
  ).toBeDisabled();
  await childList
    .getByRole("button", { name: "انتقال سالاد فصل به بالا" })
    .click();
  await expect
    .poll(
      () =>
        categories.findIndex((item) => item.name === "سالاد فصل") <
        categories.findIndex((item) => item.name === "سالاد ویژه"),
    )
    .toBe(true);
  await order.getByRole("button", { name: "بستن" }).click();
  await page.getByRole("button", { name: "تغییر بخش نمونه" }).click();
  await page.getByRole("button", { name: "افزودن ماده اولیه" }).click();
  await page.getByRole("textbox", { name: "نام ماده اولیه" }).fill("پنیر");
  await page.getByRole("button", { name: "انتخاب آیکون" }).click();
  await page
    .getByRole("dialog", { name: "انتخاب رسانه" })
    .getByRole("button", { name: "انتخاب رسانه", exact: true })
    .click();
  await page.getByRole("button", { name: "ذخیره", exact: true }).click();
  await expect(page.getByText("پنیر")).toBeVisible();
  await page.getByRole("button", { name: "بایگانی پنیر" }).click();
  await page
    .getByRole("dialog", { name: "بایگانی ماده اولیه" })
    .getByRole("button", { name: "بایگانی", exact: true })
    .click();
  await expect(page.getByText("هنوز ماده اولیه ثبت نشده است.")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
