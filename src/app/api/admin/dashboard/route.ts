import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { dashboardMetrics, dashboardOrders } from "@/server/orders/dashboard";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function GET(request: Request) {
  try {
    await requirePrincipal("admin");
    const params = new URL(request.url).searchParams;
    if (params.get("section") === "orders") {
      const page = params.get("page") ?? "1";
      if (!/^[1-9]\d{0,3}$/.test(page)) throw new RangeError();
      return reply(
        await dashboardOrders(
          params.get("status") ?? "all",
          Number(page),
          params.get("all") === "1" ? 20 : 10,
        ),
      );
    }
    if (params.get("section") === "metrics")
      return reply(await dashboardMetrics(params.get("period") ?? "week"));
    throw new RangeError();
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return reply({ error: "دسترسی امکان‌پذیر نیست." }, 401);
    if (error instanceof RangeError)
      return reply({ error: "درخواست معتبر نیست." }, 400);
    return reply({ error: "دریافت اطلاعات ممکن نشد. دوباره تلاش کنید." }, 503);
  }
}
