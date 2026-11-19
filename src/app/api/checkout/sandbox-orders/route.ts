import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { readJsonObject, validMutationOrigin } from "@/server/account/request";
import {
  submitSandboxOrder,
  listSandboxOrders,
  sandboxPaymentEnabled,
} from "@/server/payment/sandbox-orders";
import { DeliveryUnavailable } from "@/server/delivery/delivery";

export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET() {
  try {
    const user = await requirePrincipal("customer");
    return reply({
      enabled: sandboxPaymentEnabled(),
      items: await listSandboxOrders(user.id),
    });
  } catch (error) {
    return error instanceof UnauthorizedError
      ? reply({ error: "ابتدا وارد حساب خود شوید." }, 401)
      : reply({ error: "دریافت سفارش‌های آزمایشی ممکن نشد." }, 503);
  }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    const user = await requirePrincipal("customer");
    const body = await readJsonObject(request, 1024);
    if (
      Object.keys(body).some((key) => key !== "token") ||
      typeof body.token !== "string"
    )
      throw new RangeError();
    if (!sandboxPaymentEnabled())
      return reply({ error: "درگاه آزمایشی پیکربندی نشده است." }, 503);
    return reply(await submitSandboxOrder(user.id, body.token));
  } catch (error) {
    return error instanceof UnauthorizedError
      ? reply({ error: "ابتدا وارد حساب خود شوید." }, 401)
      : error instanceof DeliveryUnavailable
        ? reply(
            {
              error:
                "پیش‌فاکتور تغییر کرده یا منقضی شده است؛ نشانی و زمان تحویل را دوباره انتخاب کنید.",
            },
            409,
          )
        : error instanceof RangeError
          ? reply(
              { error: "اطلاعات سفارش یا مبلغ برای درگاه آزمایشی معتبر نیست." },
              400,
            )
          : reply(
              { error: "ثبت سفارش آزمایشی ممکن نشد. دوباره تلاش کنید." },
              503,
            );
  }
}
