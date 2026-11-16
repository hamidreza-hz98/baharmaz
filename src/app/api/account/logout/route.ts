import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  requirePrincipal,
  clearSessionCookie,
  UnauthorizedError,
} from "@/server/identity/guards";
import { revokeSession } from "@/server/identity/identity";
import { validMutationOrigin } from "@/server/account/request";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    await requirePrincipal("customer");
    const token = (await cookies()).get("lamsechi_customer_session")?.value;
    await revokeSession(token, "customer");
    await clearSessionCookie("customer");
    return reply({ ok: true });
  } catch (error) {
    return error instanceof UnauthorizedError
      ? reply({ error: "ابتدا وارد حساب خود شوید." }, 401)
      : reply({ error: "خروج ممکن نشد؛ دوباره تلاش کنید." }, 503);
  }
}
