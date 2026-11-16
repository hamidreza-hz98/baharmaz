import { NextResponse } from "next/server";
import { listPublicProducts } from "@/server/public-catalog/catalog";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams;
    const result = await listPublicProducts({
      category: p.get("category") || undefined,
      sort: p.get("sort") || "newest",
      cursor: p.get("cursor") || undefined,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof RangeError
            ? "فیلتر معتبر نیست."
            : "دریافت محصولات ممکن نشد.",
      },
      {
        status: error instanceof RangeError ? 400 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
