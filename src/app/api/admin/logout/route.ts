import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { validMutationOrigin } from "@/server/account/request";
import {
  clearSessionCookie,
  requirePrincipal,
  UnauthorizedError,
} from "@/server/identity/guards";
import { revokeSession } from "@/server/identity/identity";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    await requirePrincipal("admin");
    await revokeSession(
      (await cookies()).get("lamsechi_admin_session")?.value,
      "admin",
    );
    await clearSessionCookie("admin");
    return reply({ ok: true });
  } catch (error) {
    return error instanceof UnauthorizedError
      ? reply({ error: "ابتدا وارد حساب مدیریت شوید." }, 401)
      : reply({ error: "خروج ممکن نشد. دوباره تلاش کنید." }, 503);
  }
}
