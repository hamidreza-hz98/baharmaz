import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { validMutationOrigin, readJsonObject } from "@/server/account/request";
import { validateCoordinates } from "@/server/address/address";
import {
  reserveGeocode,
  reverseGeocode,
  reverseConfig,
  GeocodeBusy,
} from "@/server/address/map-provider";
export const dynamic = "force-dynamic";
const reply = (data: object, status: number) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    await requirePrincipal("customer");
    const input = await readJsonObject(request, 1024);
    const coords = validateCoordinates(input);
    if (!coords) throw new RangeError();
    if (!reverseConfig())
      return reply(
        { error: "نشانی‌یاب پیکربندی نشده است؛ نشانی را دستی وارد کنید." },
        503,
      );
    await reserveGeocode();
    const address = await reverseGeocode(coords);
    return reply({ address }, 200);
  } catch (error) {
    return reply(
      {
        error:
          error instanceof GeocodeBusy
            ? "کمی صبر کنید و دوباره تلاش کنید."
            : error instanceof UnauthorizedError
              ? "ابتدا وارد حساب خود شوید."
              : error instanceof RangeError || error instanceof SyntaxError
                ? "مختصات معتبر نیست."
                : "دریافت نشانی ممکن نشد؛ نشانی را دستی وارد کنید.",
      },
      error instanceof GeocodeBusy
        ? 429
        : error instanceof UnauthorizedError
          ? 401
          : error instanceof RangeError || error instanceof SyntaxError
            ? 400
            : 503,
    );
  }
}
