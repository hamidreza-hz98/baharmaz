import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { validMutationOrigin, readJsonObject } from "@/server/account/request";
import {
  deliveryOptions,
  createQuote,
  validateQuote,
  DeliveryNotFound,
  DeliveryUnavailable,
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
const errors: Record<string, string> = {
  not_configured: "قوانین ارسال هنوز تنظیم نشده است.",
  coordinates_required: "برای بررسی محدوده، موقعیت نشانی را ثبت کنید.",
  outside: "این نشانی خارج از محدوده ارسال است.",
  ambiguous: "محدوده ارسال این نشانی مشخص نیست؛ با فروشگاه تماس بگیرید.",
  slot_unavailable: "این زمان دیگر قابل انتخاب نیست.",
  cart_changed: "سبد تغییر کرده است؛ آن را بررسی کنید.",
  quote_expired: "پیش‌فاکتور ارسال منقضی شده است؛ دوباره دریافت کنید.",
  quote_changed: "سبد یا شرایط ارسال تغییر کرده است؛ دوباره بررسی کنید.",
};
function fail(error: unknown) {
  return error instanceof UnauthorizedError
    ? reply({ error: "ابتدا وارد حساب خود شوید." }, 401)
    : error instanceof DeliveryNotFound
      ? reply({ error: "نشانی پیدا نشد." }, 404)
      : error instanceof DeliveryUnavailable
        ? reply(
            {
              error: errors[error.code] || "ارسال در دسترس نیست.",
              code: error.code,
            },
            409,
          )
        : error instanceof RangeError || error instanceof SyntaxError
          ? reply({ error: "اطلاعات انتخاب‌شده معتبر نیست." }, 400)
          : reply({ error: "محاسبه ارسال ممکن نشد؛ دوباره تلاش کنید." }, 503);
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    const principal = await requirePrincipal("customer");
    const body = await readJsonObject(request, 4096);
    if (
      Object.keys(body).some(
        (k) => !["action", "addressId", "date", "slotId", "token"].includes(k),
      )
    )
      throw new RangeError();
    if (body.action === "options" && typeof body.addressId === "string")
      return reply(await deliveryOptions(principal.id, body.addressId));
    if (body.action === "quote" && typeof body.addressId === "string") {
      if ((await cookies()).get("lamsechi_guest_cart")?.value)
        return reply({ error: "ابتدا سبد خرید را دوباره بررسی کنید." }, 409);
      return reply(
        await createQuote(principal.id, body.addressId, body.date, body.slotId),
      );
    }
    if (body.action === "validate")
      return reply(await validateQuote(principal.id, body.token));
    throw new RangeError();
  } catch (error) {
    return fail(error);
  }
}
