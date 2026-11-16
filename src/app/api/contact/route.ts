import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/database/connection";
import { validMutationOrigin, readJsonObject } from "@/server/account/request";
import { submitContact, ContactThrottled } from "@/server/contact/contact";
export const dynamic = "force-dynamic";
const reply = (message: string, status: number) =>
  NextResponse.json(
    { message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
export async function POST(request: Request) {
  if (!validMutationOrigin(request)) return reply("درخواست معتبر نیست.", 403);
  try {
    const input = await readJsonObject(request, 16384);
    await connectDatabase();
    await submitContact(input);
    return reply("پیام شما ثبت شد و برای بررسی در دسترس فروشگاه است.", 201);
  } catch (error) {
    if (error instanceof ContactThrottled)
      return reply("تعداد درخواست‌ها زیاد است؛ بعداً دوباره تلاش کنید.", 429);
    if (error instanceof RangeError || error instanceof SyntaxError)
      return reply("نام، شماره همراه و متن پیام را بررسی کنید.", 400);
    return reply("ثبت پیام ممکن نشد؛ دوباره تلاش کنید.", 503);
  }
}
