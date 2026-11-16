import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { validMutationOrigin, readJsonObject } from "@/server/account/request";
import { staticPages } from "@/shared/content";
import {
  ContentConflict,
  readStaticSeo,
  saveStaticSeo,
} from "@/server/content/settings";

export const dynamic = "force-dynamic";
const reply = (data: object, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const fail = (error: unknown) =>
  error instanceof UnauthorizedError
    ? reply({ error: "دسترسی امکان‌پذیر نیست." }, 401)
    : error instanceof ContentConflict
      ? reply({ error: "تنظیمات سئو تغییر کرده است؛ نسخه جدید را دریافت کنید." }, 409)
      : error instanceof RangeError || error instanceof SyntaxError
        ? reply({ error: "اطلاعات سئو معتبر نیست." }, 400)
        : reply({ error: "دریافت یا ذخیره سئو ممکن نشد." }, 500);

export async function GET() {
  try {
    await requirePrincipal("admin");
    return reply(await readStaticSeo());
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    await requirePrincipal("admin");
    const input = await readJsonObject(request, 64 * 1024);
    if (Object.keys(input).some((key) => !["revision", "seo"].includes(key)))
      throw new RangeError("Unknown field");
    const result = await saveStaticSeo(input.seo, input.revision);
    for (const page of staticPages) {
      const path =
        page === "home"
          ? "/"
          : page === "products"
            ? "/products"
            : `/${page === "faq" ? "faq" : page}`;
      revalidatePath(path);
    }
    return reply(result);
  } catch (error) {
    return fail(error);
  }
}
