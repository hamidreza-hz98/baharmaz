import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { validMutationOrigin, readJsonObject } from "@/server/account/request";
import { CatalogWriteBusy } from "@/server/catalog/reference-lock";
import {
  IMAGE_LIMIT,
  VIDEO_LIMIT,
  MediaValidationError,
  deleteMediaBatch,
  storeMedia,
  listMedia,
} from "@/server/media/storage";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const failure = (message: string, status: number) =>
  NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
export async function GET(request: Request) {
  try {
    await requirePrincipal("admin");
    const params = new URL(request.url).searchParams;
    const kind = params.get("kind") ?? "all";
    const pageText = params.get("page") ?? "1";
    if (
      !["all", "image", "video"].includes(kind) ||
      !/^[1-9]\d{0,3}$/.test(pageText)
    )
      return failure("فیلتر معتبر نیست.", 400);
    const result = await listMedia({
      kind: kind as "all" | "image" | "video",
      query: params.get("q") ?? "",
      page: Number(pageText),
      limit: 24,
    });
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return failure("دسترسی امکان‌پذیر نیست.", 401);
    if (error instanceof RangeError) return failure("فیلتر معتبر نیست.", 400);
    return failure("دریافت رسانه‌ها ممکن نشد.", 500);
  }
}
async function readLimited(request: Request, limit: number): Promise<Buffer> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit))
    throw new RangeError("File too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new MediaValidationError("Missing file.");
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new RangeError("File too large.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}
export async function POST(request: Request) {
  try {
    const origin = process.env.APP_ORIGIN;
    if (!origin || request.headers.get("origin") !== new URL(origin).origin)
      return failure("درخواست معتبر نیست.", 403);
    await requirePrincipal("admin");
    const type = (request.headers.get("content-type") ?? "").toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp", "video/mp4"].includes(type))
      return failure("نوع فایل پشتیبانی نمی‌شود.", 415);
    const rawName = request.headers.get("x-file-name") ?? "media";
    if (rawName.length > 1024) return failure("نام فایل معتبر نیست.", 400);
    const filename = decodeURIComponent(rawName);
    const result = await storeMedia(
      await readLimited(
        request,
        type === "video/mp4" ? VIDEO_LIMIT : IMAGE_LIMIT,
      ),
      filename,
      type,
    );
    return NextResponse.json(
      { media: result },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return failure("دسترسی امکان‌پذیر نیست.", 401);
    if (error instanceof RangeError && !(error instanceof MediaValidationError))
      return failure("اندازه فایل بیش از حد مجاز است.", 413);
    if (error instanceof MediaValidationError || error instanceof URIError)
      return failure("فایل معتبر یا قابل پردازش نیست.", 400);
    return failure("بارگذاری انجام نشد. دوباره تلاش کنید.", 500);
  }
}

export async function DELETE(request: Request) {
  if (!validMutationOrigin(request))
    return failure("درخواست معتبر نیست.", 403);
  try {
    await requirePrincipal("admin");
    const input = await readJsonObject(request, 4096);
    if (
      Object.keys(input).some((key) => key !== "ids") ||
      !Array.isArray(input.ids) ||
      !input.ids.every((id) => typeof id === "string")
    )
      return failure("فهرست رسانه معتبر نیست.", 400);
    const result = await deleteMediaBatch(input.ids as string[]);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError)
      return failure("دسترسی امکان‌پذیر نیست.", 401);
    if (error instanceof CatalogWriteBusy)
      return failure("اطلاعات در حال تغییر است؛ دوباره تلاش کنید.", 409);
    if (error instanceof RangeError)
      return failure("فهرست رسانه معتبر نیست.", 400);
    return failure("حذف رسانه‌ها ممکن نشد.", 500);
  }
}
