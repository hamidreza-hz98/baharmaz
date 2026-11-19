import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { readJsonObject, validMutationOrigin } from "@/server/account/request";
import {
  DeliveryQuote,
  validateQuote,
  DeliveryUnavailable,
} from "@/server/delivery/delivery";
import { Address } from "@/server/address/address";
import { getCustomerProfile } from "@/server/account/account";
import { customerId, readCart } from "@/server/cart/cart";
export const dynamic = "force-dynamic";
const reply = (data: object, status = 200) =>
  NextResponse.json(data, {
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
    const principal = await requirePrincipal("customer");
    const input = await readJsonObject(request, 1024);
    if (
      Object.keys(input).some((k) => k !== "token") ||
      typeof input.token !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(input.token)
    )
      throw new RangeError();
    const quote = await validateQuote(principal.id, input.token);
    const saved = await DeliveryQuote.findOne({
      tokenHash: createHash("sha256").update(input.token).digest("hex"),
      customerId: principal.id,
    })
      .select("addressId")
      .lean();
    if (!saved) throw new DeliveryUnavailable("quote_expired");
    const [address, customer, cart] = await Promise.all([
      Address.findOne({ _id: saved.addressId, customerId: principal.id })
        .select("label recipient mobile address postalCode")
        .lean(),
      getCustomerProfile(principal.id),
      readCart(customerId(principal.id)),
    ]);
    if (!address || !customer) throw new DeliveryUnavailable("quote_changed");
    await validateQuote(principal.id, input.token);
    return reply({
      review: {
        customer: { name: customer.name, mobile: customer.mobile },
        address: {
          label: address.label,
          recipient: address.recipient,
          mobile: address.mobile,
          address: address.address,
          postalCode: address.postalCode,
        },
        items: cart.items.map((item) => ({
          id: item.productId,
          title: item.title,
          image: item.image,
          quantity: item.quantity,
          saleRials: item.saleRials,
          lineRials: item.lineRials,
        })),
        subtotalRials: cart.subtotalRials,
        discountRials: cart.discountRials,
        delivery: quote,
      },
    });
  } catch (error) {
    return error instanceof UnauthorizedError
      ? reply({ error: "ابتدا وارد حساب خود شوید." }, 401)
      : error instanceof DeliveryUnavailable
        ? reply(
            {
              error:
                "پیش‌فاکتور منقضی شده یا اطلاعات تغییر کرده است؛ دوباره انتخاب کنید.",
            },
            409,
          )
        : error instanceof RangeError || error instanceof SyntaxError
          ? reply({ error: "اطلاعات پیش‌فاکتور معتبر نیست." }, 400)
          : reply(
              { error: "دریافت پیش‌فاکتور ممکن نشد؛ دوباره تلاش کنید." },
              503,
            );
  }
}
