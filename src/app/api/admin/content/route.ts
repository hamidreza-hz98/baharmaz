import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { readContent } from "@/server/content/settings";
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
    : error instanceof RangeError || error instanceof SyntaxError
      ? reply({ error: "اطلاعات تنظیمات معتبر نیست." }, 400)
      : reply({ error: "دریافت تنظیمات ممکن نشد." }, 500);
export async function GET() {
  try {
    await requirePrincipal("admin");
    return reply(await readContent());
  } catch (error) {
    return fail(error);
  }
}
export async function PUT() {
  return reply(
    { error: "هر بخش تنظیمات باید از صفحه اختصاصی خودش ذخیره شود." },
    405,
  );
}
