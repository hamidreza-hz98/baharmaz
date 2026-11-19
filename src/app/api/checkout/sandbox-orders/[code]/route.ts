import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import {
  getSandboxOrder,
  reconcileSandboxOrder,
} from "@/server/payment/sandbox-orders";
import { validMutationOrigin } from "@/server/account/request";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const user = await requirePrincipal("customer");
    const { code } = await params;
    const order = await getSandboxOrder(user.id, code);
    return order
      ? reply({ order })
      : reply({ error: "سفارش آزمایشی پیدا نشد." }, 404);
  } catch (error) {
    return error instanceof UnauthorizedError
      ? reply({ error: "ابتدا وارد حساب خود شوید." }, 401)
      : error instanceof RangeError
        ? reply({ error: "سفارش پیدا نشد." }, 404)
        : reply({ error: "دریافت سفارش ممکن نشد." }, 503);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    const user = await requirePrincipal("customer");
    const { code } = await params;
    const order = await reconcileSandboxOrder(user.id, code);
    return order
      ? reply({ order })
      : reply({ error: "سفارش آزمایشی پیدا نشد." }, 404);
  } catch (error) {
    return error instanceof UnauthorizedError
      ? reply({ error: "ابتدا وارد حساب خود شوید." }, 401)
      : error instanceof RangeError
        ? reply({ error: "سفارش پیدا نشد." }, 404)
        : reply({ error: "بررسی پرداخت ممکن نشد." }, 503);
  }
}
