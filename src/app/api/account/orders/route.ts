import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { listOrders, getOrder, OrderNotFound } from "@/server/orders/orders";
export const dynamic = "force-dynamic";
const reply = (data: object, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function GET(request: Request) {
  try {
    const principal = await requirePrincipal("customer");
    const q = new URL(request.url).searchParams;
    const code = q.get("code");
    if (code !== null)
      return reply({ order: await getOrder(principal.id, code) });
    const raw = q.get("page") || "1";
    if (!/^[1-9]\d{0,3}$/.test(raw)) throw new RangeError();
    return reply(
      await listOrders(principal.id, q.get("status") || "all", Number(raw)),
    );
  } catch (error) {
    return error instanceof UnauthorizedError
      ? reply({ error: "ابتدا وارد حساب خود شوید." }, 401)
      : error instanceof OrderNotFound
        ? reply({ error: "سفارش پیدا نشد." }, 404)
        : error instanceof RangeError
          ? reply({ error: "درخواست معتبر نیست." }, 400)
          : reply({ error: "دریافت سفارش‌ها ممکن نشد." }, 503);
  }
}
