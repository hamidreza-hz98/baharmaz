import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { validMutationOrigin, readJsonObject } from "@/server/account/request";
import {
  getAdminOrder,
  listAdminOrders,
  updateAdminOrder,
  AdminOrderConflict,
  AdminOrderNotFound,
} from "@/server/orders/admin-orders";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function fail(error: unknown) {
  if (error instanceof UnauthorizedError)
    return reply({ error: "دسترسی امکان‌پذیر نیست." }, 401);
  if (error instanceof AdminOrderNotFound)
    return reply({ error: "سفارش پیدا نشد." }, 404);
  if (error instanceof AdminOrderConflict)
    return reply(
      {
        error:
          "سفارش تغییر کرده یا ظرفیت ثبت تغییرات تکمیل شده است؛ اطلاعات را تازه کنید.",
      },
      409,
    );
  if (error instanceof RangeError || error instanceof SyntaxError)
    return reply({ error: "تغییر یا اطلاعات واردشده معتبر نیست." }, 400);
  return reply({ error: "درخواست انجام نشد. دوباره تلاش کنید." }, 503);
}
export async function GET(request: Request) {
  try {
    await requirePrincipal("admin");
    const params = new URL(request.url).searchParams,
      code = params.get("code");
    if (code !== null) return reply({ order: await getAdminOrder(code) });
    const page = params.get("page") ?? "1";
    if (!/^[1-9]\d{0,3}$/.test(page)) throw new RangeError();
    return reply(
      await listAdminOrders(
        params.get("status") ?? "all",
        params.get("q") ?? "",
        Number(page),
      ),
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    const principal = await requirePrincipal("admin"),
      input = await readJsonObject(request);
    if (
      Object.keys(input).some(
        (key) => !["code", "revision", "status", "note"].includes(key),
      ) ||
      typeof input.code !== "string" ||
      typeof input.revision !== "number" ||
      typeof input.status !== "string" ||
      typeof input.note !== "string"
    )
      throw new RangeError();
    return reply({
      order: await updateAdminOrder(
        input.code,
        input.revision,
        input.status,
        input.note,
        principal.id,
      ),
    });
  } catch (error) {
    return fail(error);
  }
}
