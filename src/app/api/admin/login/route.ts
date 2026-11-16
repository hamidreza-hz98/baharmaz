import { NextResponse } from "next/server";
import { validMutationOrigin, readJsonObject } from "@/server/account/request";
import { connectDatabase } from "@/server/database/connection";
import {
  Admin,
  createSession,
  verifyPassword,
} from "@/server/identity/identity";
import { setSessionCookie } from "@/server/identity/guards";
import { allowAdminLogin } from "@/server/otp/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const dummyHash =
  "scrypt-v1$KioqKioqKioqKioqKioqKg$gcpjlIzYhKjDtV7AcF0zOsZM3isrhSy3IO1NM-SwNHPwMxj1jb2X0cstFULPcde5c5rMilM6IJyyRaY0GqtLnA";
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    const input = await readJsonObject(request);
    await connectDatabase();
    if (!(await allowAdminLogin()))
      return reply(
        { error: "تلاش‌های زیادی انجام شده است. کمی بعد دوباره تلاش کنید." },
        429,
      );
    const username =
      typeof input.username === "string"
        ? input.username.trim().toLowerCase()
        : "";
    const password = typeof input.password === "string" ? input.password : "";
    const admin = await Admin.findById("primary")
      .select("+passwordHash")
      .lean();
    const passwordMatches = await verifyPassword(
      password,
      admin?.passwordHash ?? dummyHash,
    );
    if (
      !/^[a-z0-9._-]{3,64}$/.test(username) ||
      !admin ||
      username !== admin.username ||
      !passwordMatches
    )
      return reply({ error: "نام کاربری یا رمز عبور درست نیست." }, 401);
    const session = await createSession("admin", "primary");
    await setSessionCookie("admin", session.token, session.expiresAt);
    return reply({ ok: true });
  } catch (error) {
    if (error instanceof RangeError || error instanceof SyntaxError)
      return reply({ error: "اطلاعات واردشده را بررسی کنید." }, 400);
    return reply(
      { error: "ورود موقتاً امکان‌پذیر نیست. دوباره تلاش کنید." },
      503,
    );
  }
}
