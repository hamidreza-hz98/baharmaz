import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { listAdminSandboxOrders } from "@/server/payment/sandbox-orders";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requirePrincipal("admin");
    return NextResponse.json(
      { items: await listAdminSandboxOrders() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof UnauthorizedError
            ? "دسترسی امکان‌پذیر نیست."
            : "دریافت سفارش‌های آزمایشی ممکن نشد.",
      },
      {
        status: error instanceof UnauthorizedError ? 401 : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
