import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import {
  getCustomerProfile,
  updateCustomerProfile,
  startPhoneChange,
  verifyOldPhone,
  sendNewPhoneCode,
  confirmNewPhone,
} from "@/server/account/account";
import { readJsonObject, validMutationOrigin } from "@/server/account/request";
import { configuredSmsProvider } from "@/server/otp/configured-provider";
import { allowOtpRequest } from "@/server/otp/rate-limit";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const response = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const errorResponse = (error: unknown) =>
  error instanceof UnauthorizedError
    ? response({ error: "ابتدا وارد حساب خود شوید." }, 401)
    : error instanceof RangeError || error instanceof SyntaxError
      ? response({ error: "اطلاعات واردشده معتبر نیست." }, 400)
      : response({ error: "درخواست انجام نشد. دوباره تلاش کنید." }, 400);
export async function GET() {
  try {
    const principal = await requirePrincipal("customer");
    const profile = await getCustomerProfile(principal.id);
    return profile
      ? response({ profile })
      : response({ error: "حساب یافت نشد." }, 404);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return response({ error: "درخواست معتبر نیست." }, 403);
  try {
    const principal = await requirePrincipal("customer");
    const input = await readJsonObject(request);
    if (
      input.action === "profile" &&
      typeof input.name === "string" &&
      (typeof input.birthdate === "string" || input.birthdate === null)
    ) {
      const profile = await updateCustomerProfile(
        principal.id,
        input.name,
        input.birthdate,
      );
      return response({ profile });
    }
    if (
      !["start", "verify-old", "send-new", "verify-new"].includes(
        String(input.action),
      )
    )
      return response({ error: "درخواست معتبر نیست." }, 400);
    if (!(await allowOtpRequest()))
      return response(
        { error: "تعداد درخواست‌ها زیاد است. بعداً تلاش کنید." },
        429,
      );
    if (input.action === "start") {
      const result = await startPhoneChange(
        principal.id,
        principal.sessionId,
        configuredSmsProvider(),
      );
      return result === "sent"
        ? response({ ok: true })
        : response(
            { error: "ارسال کد ممکن نشد. کمی بعد دوباره تلاش کنید." },
            result === "throttled" ? 429 : 503,
          );
    }
    if (input.action === "verify-old" && typeof input.code === "string")
      return (await verifyOldPhone(
        principal.id,
        principal.sessionId,
        input.code,
      ))
        ? response({ ok: true })
        : response({ error: "کد نامعتبر یا منقضی شده است." }, 400);
    if (input.action === "send-new" && typeof input.mobile === "string") {
      const result = await sendNewPhoneCode(
        principal.id,
        principal.sessionId,
        input.mobile,
        configuredSmsProvider(),
      );
      return result === "sent"
        ? response({ ok: true })
        : response(
            { error: "ارسال کد ممکن نشد. کمی بعد دوباره تلاش کنید." },
            result === "throttled" ? 429 : 503,
          );
    }
    if (input.action === "verify-new" && typeof input.code === "string")
      return (await confirmNewPhone(
        principal.id,
        principal.sessionId,
        input.code,
      ))
        ? response({
            ok: true,
            profile: await getCustomerProfile(principal.id),
          })
        : response({ error: "کد نامعتبر یا منقضی شده است." }, 400);
    return response({ error: "اطلاعات واردشده معتبر نیست." }, 400);
  } catch (error) {
    return errorResponse(error);
  }
}
