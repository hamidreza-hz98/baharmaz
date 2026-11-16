import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { validMutationOrigin } from "@/server/account/request";
import { CatalogWriteBusy } from "@/server/catalog/reference-lock";
import {
  deleteMedia,
  getMedia,
  MediaInUseError,
  MediaNotFoundError,
} from "@/server/media/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const failure = (status: number) =>
  NextResponse.json(
    {
      error:
        status === 401
          ? "دسترسی امکان‌پذیر نیست."
          : status === 404
            ? "رسانه یافت نشد."
            : "دریافت رسانه ممکن نشد.",
    },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requirePrincipal("admin");
    const { id } = await params;
    const media = await getMedia(id);
    if (!media) return failure(404);
    const { file, fileId, storage } = media;
    const invalidRange = () =>
      new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${file.length}`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    let start = 0;
    let end = file.length - 1;
    let status = 200;
    const range = request.headers.get("range");
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2])) return invalidRange();
      if (!match[1]) {
        const suffix = Number(match[2]);
        if (!Number.isSafeInteger(suffix) || suffix < 1) return invalidRange();
        start = Math.max(file.length - suffix, 0);
      } else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(Number(match[2]), end);
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start >= file.length ||
        start > end
      )
        return invalidRange();
      status = 206;
    }
    const stream = storage.openDownloadStream(fileId, { start, end: end + 1 });
    const headers = new Headers({
      "Content-Type": file.metadata!.contentType,
      "Content-Length": String(end - start + 1),
      "Accept-Ranges": "bytes",
      "Content-Disposition": `inline; filename="${id}.${file.metadata!.contentType === "image/webp" ? "webp" : "mp4"}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    if (status === 206)
      headers.set("Content-Range", `bytes ${start}-${end}/${file.length}`);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      status,
      headers,
    });
  } catch (error) {
    return failure(error instanceof UnauthorizedError ? 401 : 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const reply = (error: string, status: number) =>
    NextResponse.json(
      { error },
      {
        status,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  if (!validMutationOrigin(request))
    return reply("درخواست معتبر نیست.", 403);
  try {
    await requirePrincipal("admin");
    const { id } = await params;
    const deletedId = await deleteMedia(id);
    return NextResponse.json(
      { deletedIds: [deletedId], blocked: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return reply("دسترسی امکان‌پذیر نیست.", 401);
    if (error instanceof MediaNotFoundError) return reply("رسانه یافت نشد.", 404);
    if (error instanceof MediaInUseError)
      return reply(
        "این رسانه در محصولات، دسته‌بندی‌ها، مواد اولیه، سفارش‌ها یا محتوای سایت استفاده می‌شود و حذف نشد.",
        409,
      );
    if (error instanceof CatalogWriteBusy)
      return reply("اطلاعات در حال تغییر است؛ دوباره تلاش کنید.", 409);
    if (error instanceof RangeError) return reply("شناسه رسانه معتبر نیست.", 400);
    return reply("حذف رسانه ممکن نشد.", 500);
  }
}
