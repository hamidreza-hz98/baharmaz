import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { connectDatabase } from "@/server/database/connection";
import { setSessionCookie } from "@/server/identity/guards";
import { issueOtp } from "@/server/otp/challenge";
import { configuredSmsProvider } from "@/server/otp/configured-provider";
import {
  verifyCustomerOtp,
  registerVerifiedCustomer,
} from "@/server/otp/customer-auth";
import { allowOtpRequest } from "@/server/otp/rate-limit";

export const runtime = "nodejs";
const ticketName = "lamsechi_registration";
const failure = (message: string, status: number) =>
  NextResponse.json(
    { ok: false, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
export async function POST(request: Request) {
  try {
    const origin = process.env.APP_ORIGIN;
    if (
      !origin ||
      request.headers.get("origin") !== new URL(origin).origin ||
      !/^application\/json(?:;|$)/i.test(
        request.headers.get("content-type") ?? "",
      )
    )
      return failure("درخواست معتبر نیست.", 403);
    const reader = request.body?.getReader();
    if (!reader) return failure("درخواست معتبر نیست.", 400);
    let raw = "";
    let bytes = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) {
        await reader.cancel();
        return failure("درخواست معتبر نیست.", 400);
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data))
      return failure("درخواست معتبر نیست.", 400);
    const input = data as Record<string, unknown>;
    await connectDatabase();
    if (!(await allowOtpRequest()))
      return failure("تعداد درخواست‌ها زیاد است. بعداً تلاش کنید.", 429);
    if (input.action === "send" && typeof input.mobile === "string") {
      const result = await issueOtp(input.mobile, configuredSmsProvider());
      if (result === "delivery_failed")
        return failure("ارسال کد ممکن نشد. دوباره تلاش کنید.", 503);
      if (result === "throttled")
        return failure("لطفاً کمی صبر کنید و دوباره تلاش کنید.", 429);
      return NextResponse.json(
        { ok: true, message: "اگر شماره معتبر باشد، کد ارسال می‌شود." },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      input.action === "verify" &&
      typeof input.mobile === "string" &&
      typeof input.code === "string"
    ) {
      const result = await verifyCustomerOtp(input.mobile, input.code);
      if (result.status === "invalid")
        return failure("کد نامعتبر یا منقضی شده است.", 400);
      if (result.status === "authenticated") {
        await setSessionCookie(
          "customer",
          result.session.token,
          result.session.expiresAt,
        );
        return NextResponse.json(
          { ok: true, next: "complete" },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      (await cookies()).set(ticketName, result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth/otp",
        maxAge: 600,
      });
      return NextResponse.json(
        { ok: true, next: "registration" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      input.action === "register" &&
      typeof input.name === "string" &&
      typeof input.password === "string" &&
      typeof input.confirmation === "string"
    ) {
      if (
        input.name.trim().length < 2 ||
        input.name.trim().length > 120 ||
        input.password.length < 12 ||
        Buffer.byteLength(input.password, "utf8") > 1024 ||
        input.password !== input.confirmation
      ) {
        return failure(
          "نام و رمز عبور را بررسی کنید؛ رمز باید حداقل ۱۲ نویسه باشد و با تکرار آن یکسان باشد.",
          400,
        );
      }
      const jar = await cookies();
      const token = jar.get(ticketName)?.value ?? "";
      const session = await registerVerifiedCustomer(
        token,
        input.name,
        input.password,
        input.confirmation,
      );
      jar.set(ticketName, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/auth/otp",
        maxAge: 0,
      });
      await setSessionCookie("customer", session.token, session.expiresAt);
      return NextResponse.json(
        { ok: true, next: "complete" },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return failure("اطلاعات واردشده را بررسی کنید.", 400);
  } catch (error) {
    if (error instanceof RangeError || error instanceof SyntaxError)
      return failure("اطلاعات واردشده را بررسی کنید.", 400);
    return failure("امکان انجام درخواست وجود ندارد. دوباره تلاش کنید.", 503);
  }
}
