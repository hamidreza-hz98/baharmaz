import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { validMutationOrigin, readJsonObject } from "@/server/account/request";
import {
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  AddressNotFound,
  AddressConflict,
} from "@/server/address/address";
export const dynamic = "force-dynamic";
const reply = (data: object, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const fail = (error: unknown) =>
  error instanceof UnauthorizedError
    ? reply({ error: "ابتدا وارد حساب خود شوید." }, 401)
    : error instanceof AddressNotFound
      ? reply({ error: "نشانی پیدا نشد." }, 404)
      : error instanceof AddressConflict
        ? reply({ error: "نشانی تغییر کرده است؛ فهرست را تازه کنید." }, 409)
        : error instanceof RangeError || error instanceof SyntaxError
          ? reply({ error: "اطلاعات نشانی را بررسی کنید." }, 400)
          : reply({ error: "عملیات ممکن نشد؛ دوباره تلاش کنید." }, 503);
export async function GET() {
  try {
    const p = await requirePrincipal("customer");
    return reply({ items: await listAddresses(p.id) });
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    const p = await requirePrincipal("customer");
    const body = await readJsonObject(request, 8192);
    if (
      Object.keys(body).some(
        (k) => !["action", "id", "revision", "address"].includes(k),
      )
    )
      throw new RangeError();
    if (
      body.action === "create" &&
      body.address &&
      typeof body.address === "object" &&
      !Array.isArray(body.address)
    )
      return reply(
        {
          item: await createAddress(
            p.id,
            body.address as Record<string, unknown>,
          ),
        },
        201,
      );
    if (
      body.action === "update" &&
      typeof body.id === "string" &&
      body.address &&
      typeof body.address === "object" &&
      !Array.isArray(body.address)
    )
      return reply({
        item: await updateAddress(
          p.id,
          body.id,
          body.revision,
          body.address as Record<string, unknown>,
        ),
      });
    if (body.action === "delete" && typeof body.id === "string") {
      await deleteAddress(p.id, body.id, body.revision);
      return reply({ ok: true });
    }
    throw new RangeError();
  } catch (error) {
    return fail(error);
  }
}
