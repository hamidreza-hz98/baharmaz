import { NextResponse } from "next/server";
import {
  requirePrincipal,
  UnauthorizedError,
  clearSessionCookie,
} from "@/server/identity/guards";
import { Admin } from "@/server/identity/identity";
import {
  updateAdminProfile,
  listAdminSessions,
  revokeAdminSession,
} from "@/server/account/account";
import { readJsonObject, validMutationOrigin } from "@/server/account/request";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const errorResponse = (error: unknown) =>
  error instanceof UnauthorizedError
    ? response({ error: "دسترسی امکان‌پذیر نیست." }, 401)
    : response({ error: "درخواست انجام نشد. اطلاعات را بررسی کنید." }, 400);
export async function GET() {
  try {
    const principal = await requirePrincipal("admin");
    const profile = await Admin.findById(principal.id)
      .select("name username mobile")
      .lean();
    const sessions = await listAdminSessions(principal.id, principal.sessionId);
    return response({ profile, sessions });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return response({ error: "درخواست معتبر نیست." }, 403);
  try {
    const principal = await requirePrincipal("admin");
    const input = await readJsonObject(request);
    if (
      input.action === "profile" &&
      typeof input.name === "string" &&
      typeof input.username === "string" &&
      typeof input.mobile === "string"
    )
      return response({
        profile: await updateAdminProfile(
          principal.id,
          input.name,
          input.username,
          input.mobile,
        ),
      });
    if (input.action === "revoke" && typeof input.sessionId === "string") {
      const result = await revokeAdminSession(
        principal.id,
        principal.sessionId,
        input.sessionId,
      );
      if (!result.revoked)
        return response({ error: "نشست فعال یافت نشد." }, 404);
      if (result.current) await clearSessionCookie("admin");
      return response({ ok: true, current: result.current });
    }
    return response({ error: "درخواست معتبر نیست." }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}
