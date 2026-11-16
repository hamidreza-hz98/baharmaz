import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { readJsonObject, validMutationOrigin } from "@/server/account/request";
import {
  ManualUnavailable,
  manualAddresses,
  manualOptions,
  previewManualOrder,
} from "@/server/orders/manual-preview";
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
function fail(error: unknown) {
  if (error instanceof UnauthorizedError)
    return reply({ error: "دسترسی امکان‌پذیر نیست." }, 401);
  if (error instanceof ManualUnavailable)
    return reply(
      { error: "انتخاب ارسال یا محصول در دسترس نیست.", reason: error.reason },
      409,
    );
  if (error instanceof RangeError || error instanceof SyntaxError)
    return reply({ error: "اطلاعات انتخاب‌شده معتبر نیست." }, 400);
  return reply({ error: "دریافت اطلاعات ممکن نشد. دوباره تلاش کنید." }, 503);
}
export async function GET(request: Request) {
  try {
    await requirePrincipal("admin");
    return reply({
      items: await manualAddresses(
        new URL(request.url).searchParams.get("customer"),
      ),
    });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    await requirePrincipal("admin");
    const input = await readJsonObject(request, 8192);
    if (
      input.action === "options" &&
      Object.keys(input).every((key) =>
        ["action", "customerId", "addressId"].includes(key),
      )
    )
      return reply(await manualOptions(input.customerId, input.addressId));
    if (input.action === "preview")
      return reply(await previewManualOrder(input));
    return reply({ error: "ثبت سفارش هنوز در دسترس نیست." }, 409);
  } catch (error) {
    return fail(error);
  }
}
