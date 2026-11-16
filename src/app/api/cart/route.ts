import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/database/connection";
import { resolveSessionDetails } from "@/server/identity/identity";
import { validMutationOrigin, readJsonObject } from "@/server/account/request";
import {
  guestToken,
  guestId,
  customerId,
  readCart,
  changeCart,
  mergeGuest,
  importDraft,
  CartConflict,
  CartUnavailable,
  Cart,
} from "@/server/cart/cart";
import { allowGuestCartAllocation } from "@/server/otp/rate-limit";
export const dynamic = "force-dynamic";
const name = "lamsechi_guest_cart";
class CartRateLimited extends Error {}
const reply = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function current() {
  await connectDatabase();
  const jar = await cookies();
  const principal = await resolveSessionDetails(
    jar.get("lamsechi_customer_session")?.value,
    "customer",
  );
  let token = jar.get(name)?.value;
  if (token && !/^[A-Za-z0-9_-]{43}$/.test(token)) token = undefined;
  if (principal) {
    const id = customerId(principal.id);
    if (token) {
      await mergeGuest(guestId(token), id);
      jar.set(name, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
    return id;
  }
  const newToken = !token;
  if (!token) token = guestToken();
  const id = guestId(token);
  if (!(await Cart.exists({ _id: id })) && !(await allowGuestCartAllocation()))
    throw new CartRateLimited();
  if (newToken) {
    jar.set(name, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 90 * 86400,
    });
  }
  return id;
}
const fail = (error: unknown) =>
  error instanceof CartRateLimited
    ? reply(
        { error: "تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید." },
        429,
      )
    : error instanceof CartUnavailable
      ? reply({ error: "این محصول اکنون موجود نیست." }, 409)
      : error instanceof CartConflict
        ? reply({ error: "سبد در حال تغییر است؛ دوباره تلاش کنید." }, 409)
        : error instanceof RangeError || error instanceof SyntaxError
          ? reply({ error: "اطلاعات یا تعداد محصول معتبر نیست." }, 400)
          : reply({ error: "دریافت یا ذخیره سبد ممکن نشد." }, 503);
export async function GET() {
  try {
    return reply(await readCart(await current()));
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: Request) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    const input = await readJsonObject(request, 16384);
    const action = String(input.action ?? "");
    if (
      Object.keys(input).some(
        (k) =>
          !["action", "productId", "quantity", "draftId", "draft"].includes(k),
      )
    )
      throw new RangeError();
    const id = await current();
    if (action === "merge") return reply(await readCart(id));
    if (action === "import") await importDraft(id, input.draftId, input.draft);
    else await changeCart(id, action, input);
    return reply(await readCart(id));
  } catch (error) {
    return fail(error);
  }
}
