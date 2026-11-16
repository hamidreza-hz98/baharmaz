import { connectDatabase } from "@/server/database/connection";
import { publicOrigin } from "@/server/config/public-origin";
import { Category } from "@/server/catalog/catalog";
import { Product } from "@/server/products/products";
import { staticSeoDefaults } from "@/shared/static-seo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const xml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
export async function GET() {
  const origin = publicOrigin();
  if (!origin)
    return new Response("Public origin is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  try {
    await connectDatabase();
    const categoryRows = await Category.find({ deletedAt: null })
      .select("_id slug")
      .sort({ _id: 1 })
      .limit(50001)
      .lean();
    const categoryIds = categoryRows.map((c) => String(c._id));
    const productRows = await Product.find({
      deletedAt: null,
      categoryId: { $in: categoryIds },
    })
      .select("slug")
      .sort({ _id: 1 })
      .limit(50001)
      .lean();
    if (
      categoryRows.length +
        productRows.length +
        Object.keys(staticSeoDefaults).length >
      50000
    )
      throw new Error("Sitemap capacity exceeded");
    const urls = [
      ...Object.values(staticSeoDefaults).map(
        (item) => `${origin}${item.path}`,
      ),
      ...categoryRows.map(
        (item) => `${origin}/categories/${encodeURIComponent(item.slug)}`,
      ),
      ...productRows.map(
        (item) => `${origin}/products/${encodeURIComponent(item.slug)}`,
      ),
    ];
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${xml(url)}</loc></url>`).join("")}</urlset>`,
      {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return new Response("Sitemap temporarily unavailable.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
