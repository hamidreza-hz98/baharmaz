import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { validMutationOrigin, readJsonObject } from "@/server/account/request";
import {
  getPolicy,
  savePolicy,
  DeliveryConflict,
} from "@/server/delivery/delivery";
export const dynamic = "force-dynamic";
const reply = (data: object, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function fail(error: unknown) {
  return error instanceof UnauthorizedError
    ? reply({ error: "دسترسی امکان‌پذیر نیست." }, 401)
    : error instanceof DeliveryConflict
      ? reply({ error: "تنظیمات تغییر کرده است؛ دوباره بارگذاری کنید." }, 409)
      : error instanceof RangeError || error instanceof SyntaxError
        ? reply({ error: "قوانین ارسال معتبر نیست." }, 400)
        : reply({ error: "دریافت یا ذخیره تنظیمات ممکن نشد." }, 503);
}
export async function GET() {
  try {
    await requirePrincipal("admin");
    return reply(await getPolicy());
  } catch (error) {
    return fail(error);
  }
}
export async function PUT(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    await requirePrincipal("admin");
    const body = await readJsonObject(request, 131072);
    if (
      Object.keys(body).some((k) => !["revision", "policy"].includes(k)) ||
      !("policy" in body)
    )
      throw new RangeError();
    return reply(await savePolicy(body.policy, body.revision));
  } catch (error) {
    return fail(error);
  }
}
