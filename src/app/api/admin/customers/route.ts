import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { readJsonObject, validMutationOrigin } from "@/server/account/request";
import {
  createAdminCustomer,
  updateAdminCustomer,
  listAdminCustomers,
  CustomerConflict,
} from "@/server/account/admin-customers";
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
  if (error instanceof CustomerConflict)
    return reply(
      {
        error:
          "شماره همراه تکراری است یا اطلاعات تغییر کرده است؛ فهرست را تازه کنید.",
      },
      409,
    );
  if (error instanceof RangeError || error instanceof SyntaxError)
    return reply({ error: "نام و شماره همراه را بررسی کنید." }, 400);
  return reply({ error: "درخواست انجام نشد. دوباره تلاش کنید." }, 503);
}
export async function GET(request: Request) {
  try {
    await requirePrincipal("admin");
    const params = new URL(request.url).searchParams;
    const page = params.get("page") ?? "1",
      limit = params.get("limit") ?? "10";
    if (!/^[1-9]\d{0,3}$/.test(page) || !/^(5|10|20)$/.test(limit))
      throw new RangeError();
    return reply(
      await listAdminCustomers(
        params.get("q") ?? "",
        params.get("verification") ?? "all",
        Number(page),
        Number(limit),
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
    await requirePrincipal("admin");
    const input = await readJsonObject(request);
    if (typeof input.name !== "string" || typeof input.mobile !== "string")
      throw new RangeError();
    if (input.action === "create")
      return reply(await createAdminCustomer(input.name, input.mobile), 201);
    if (
      input.action === "update" &&
      typeof input.id === "string" &&
      typeof input.expectedMobile === "string"
    )
      return reply(
        await updateAdminCustomer(
          input.id,
          input.name,
          input.mobile,
          input.expectedMobile,
        ),
      );
    throw new RangeError();
  } catch (error) {
    return fail(error);
  }
}
