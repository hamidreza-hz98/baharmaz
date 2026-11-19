import { Readable } from "node:stream";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { getSandboxOrder } from "@/server/payment/sandbox-orders";
import { getMedia } from "@/server/media/storage";

export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  try {
    const principal = await requirePrincipal("customer");
    const { code, id } = await params;
    if (!/^[a-f\d]{24}$/i.test(id)) return new Response(null, { status: 404 });
    const order = await getSandboxOrder(principal.id, code);
    if (
      !order?.snapshot.items.some(
        (item: { image?: string | null }) => item.image === id,
      )
    )
      return new Response(null, { status: 404 });
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
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      },
    );
  } catch (error) {
    return new Response(null, {
      status:
        error instanceof UnauthorizedError
          ? 401
          : error instanceof RangeError
            ? 404
            : 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
