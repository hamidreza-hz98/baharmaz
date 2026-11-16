import { Readable } from "node:stream";
import { connectDatabase } from "@/server/database/connection";
import { Product } from "@/server/products/products";
import { getMedia } from "@/server/media/storage";
import { Category } from "@/server/catalog/catalog";
import { readContent } from "@/server/content/settings";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (!/^[a-f\d]{24}$/i.test(id)) return new Response(null, { status: 404 });
    await connectDatabase();
    const [product, category, settings] = await Promise.all([
      Product.exists({ gallery: id, deletedAt: null }),
      Category.exists({
        deletedAt: null,
        $or: [{ imageId: id }, { iconId: id }],
      }),
      readContent(),
    ]);
    const homepage = settings.content.homepage;
    const published =
      homepage.aboutImageId === id ||
      settings.content.about.imageId === id ||
      homepage.banners.some((banner) => banner.imageId === id);
    if (!product && !category && !published)
      return new Response(null, {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    const media = await getMedia(id);
    if (
      !media ||
      media.file.metadata?.kind !== "image" ||
      media.file.metadata?.contentType !== "image/webp"
    )
      return new Response(null, { status: 404 });
    return new Response(
      Readable.toWeb(
        media.storage.openDownloadStream(media.fileId),
      ) as ReadableStream,
      {
        headers: {
          "Content-Type": "image/webp",
          "Content-Length": String(media.file.length),
          "Cache-Control": "public, max-age=60",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      },
    );
  } catch {
    return new Response(null, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
