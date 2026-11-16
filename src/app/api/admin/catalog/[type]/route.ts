import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { readJsonObject, validMutationOrigin } from "@/server/account/request";
import { CatalogWriteBusy } from "@/server/catalog/reference-lock";
import {
  CatalogConflict,
  CatalogReferenced,
  CatalogNotFound,
  CatalogIndexMissing,
  createCategory,
  updateCategory,
  createIngredient,
  updateIngredient,
  archiveItem,
  listCategories,
  listIngredients,
  moveCategory,
  categoryOrdering,
} from "@/server/catalog/catalog";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const errorResponse = (error: unknown) =>
  error instanceof UnauthorizedError
    ? reply({ error: "دسترسی امکان‌پذیر نیست." }, 401)
    : error instanceof CatalogReferenced
      ? reply(
          {
            error:
              "این مورد دارای محصول یا زیردسته فعال است و نمی‌توان آن را بایگانی کرد.",
          },
          409,
        )
      : error instanceof CatalogConflict || error instanceof CatalogWriteBusy
        ? reply(
            {
              error: "تغییرات هم‌زمان یا نام تکراری است؛ اطلاعات را تازه کنید.",
            },
            409,
          )
        : error instanceof CatalogIndexMissing
          ? reply(
              {
                error:
                  "نمایه‌های کاتالوگ آماده نیستند؛ مدیر سیستم باید دستور راه‌اندازی نمایه‌های کاتالوگ را اجرا کند.",
              },
              503,
            )
          : error instanceof CatalogNotFound
            ? reply({ error: "مورد پیدا نشد." }, 404)
            : error instanceof RangeError || error instanceof SyntaxError
              ? reply({ error: "اطلاعات واردشده معتبر نیست." }, 400)
              : reply({ error: "درخواست انجام نشد. دوباره تلاش کنید." }, 500);
type Context = { params: Promise<{ type: string }> };
async function getType(
  context: Context,
): Promise<"categories" | "ingredients"> {
  const { type } = await context.params;
  if (type !== "categories" && type !== "ingredients")
    throw new CatalogNotFound();
  return type;
}
export async function GET(request: Request, context: Context) {
  try {
    await requirePrincipal("admin");
    const type = await getType(context);
    const params = new URL(request.url).searchParams;
    if (type === "categories" && params.get("order") === "all")
      return reply(await categoryOrdering());
    const page = params.get("page") ?? "1";
    if (!/^[1-9]\d{0,3}$/.test(page)) throw new RangeError();
    const query = params.get("q") ?? "";
    return reply(
      type === "categories"
        ? await listCategories(query, Number(page), 24)
        : await listIngredients(query, Number(page), 24),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request, context: Context) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    await requirePrincipal("admin");
    const type = await getType(context);
    const input = await readJsonObject(request);
    if (input.action === "create")
      return reply(
        {
          item:
            type === "categories"
              ? await createCategory(input)
              : await createIngredient(input),
        },
        201,
      );
    if (input.action === "update" && typeof input.id === "string")
      return reply({
        item:
          type === "categories"
            ? await updateCategory(input.id, input)
            : await updateIngredient(input.id, input),
      });
    if (input.action === "archive" && typeof input.id === "string") {
      await archiveItem(type, input.id);
      return reply({ ok: true });
    }
    if (
      type === "categories" &&
      input.action === "move" &&
      typeof input.id === "string" &&
      typeof input.target === "string" &&
      (input.placement === "before" || input.placement === "after") &&
      typeof input.revision === "number"
    ) {
      await moveCategory(
        input.id,
        input.target,
        input.placement,
        input.revision,
      );
      return reply({ ok: true });
    }
    throw new RangeError("Invalid action.");
  } catch (error) {
    return errorResponse(error);
  }
}
