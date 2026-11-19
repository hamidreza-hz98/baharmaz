import { categories } from "@/server/public-catalog/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(
      { items: await categories() },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return Response.json(
      { error: "دریافت دسته‌بندی‌ها ممکن نشد." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
