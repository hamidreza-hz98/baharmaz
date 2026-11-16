import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { readJsonObject, validMutationOrigin } from "@/server/account/request";
import { CatalogConflict, CatalogNotFound } from "@/server/catalog/catalog";
import { CatalogWriteBusy } from "@/server/catalog/reference-lock";
import {
  createProduct,
  updateProduct,
  changeProductPrice,
  archiveProduct,
  getProduct,
  listProducts,
} from "@/server/products/products";
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
const fail = (error: unknown) =>
  error instanceof UnauthorizedError
    ? reply({ error: "دسترسی امکان‌پذیر نیست." }, 401)
    : error instanceof CatalogConflict || error instanceof CatalogWriteBusy
      ? reply(
          {
            error:
              "محصول تغییر کرده یا عملیات دیگری در جریان است؛ اطلاعات را تازه کنید.",
          },
          409,
        )
      : error instanceof CatalogNotFound
        ? reply({ error: "محصول پیدا نشد." }, 404)
        : error instanceof RangeError || error instanceof SyntaxError
          ? reply(
              { error: "اطلاعات محصول، قیمت یا موارد انتخاب‌شده معتبر نیست." },
              400,
            )
          : reply({ error: "درخواست انجام نشد. دوباره تلاش کنید." }, 500);
export async function GET(request: Request) {
  try {
    await requirePrincipal("admin");
    const params = new URL(request.url).searchParams;
    const productId = params.get("id");
    if (productId !== null) return reply({ item: await getProduct(productId) });
    const page = params.get("page") ?? "1";
    if (!/^[1-9]\d{0,3}$/.test(page)) throw new RangeError();
    return reply(
      await listProducts({
        query: params.get("q") ?? "",
        availability: params.get("availability") ?? "all",
        promotion: params.get("promotion") ?? "all",
        page: Number(page),
        limit: 20,
      }),
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    await requirePrincipal("admin");
    const input = await readJsonObject(request, 65536);
    if (input.action === "create")
      return reply({ item: await createProduct(input) }, 201);
    if (input.action === "update" && typeof input.id === "string")
      return reply({ item: await updateProduct(input.id, input) });
    if (input.action === "price" && typeof input.id === "string")
      return reply({ item: await changeProductPrice(input.id, input) });
    if (input.action === "archive" && typeof input.id === "string") {
      await archiveProduct(input.id, input.revision);
      return reply({ ok: true });
    }
    throw new RangeError("Invalid action.");
  } catch (error) {
    return fail(error);
  }
}
