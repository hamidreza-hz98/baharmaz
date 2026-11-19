import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/database/connection";
import { publicOrigin } from "@/server/config/public-origin";
import { finishSandboxPayment } from "@/server/payment/sandbox-orders";
export const dynamic = "force-dynamic";

async function handle(
  request: Request,
  context: { params: Promise<{ reference: string }> },
) {
  const origin = publicOrigin();
  if (!origin)
    return new Response("Payment callback is not configured.", { status: 503 });
  const fallback = new URL("/checkout/address", origin);
  try {
    const { reference } = await context.params;
    let parameters: URLSearchParams;
    if (request.method === "POST") {
      if (
        !/^application\/x-www-form-urlencoded(?:;|$)/i.test(
          request.headers.get("content-type") ?? "",
        )
      )
        return NextResponse.redirect(fallback, 303);
      const reader = request.body?.getReader();
      if (!reader) return NextResponse.redirect(fallback, 303);
      let content = "",
        size = 0;
      const decoder = new TextDecoder();
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          return NextResponse.redirect(fallback, 303);
        }
        content += decoder.decode(part.value, { stream: true });
      }
      content += decoder.decode();
      parameters = new URLSearchParams(content);
    } else parameters = new URL(request.url).searchParams;
    const transids = parameters.getAll("transid"),
      statuses = parameters.getAll("status");
    if (transids.length !== 1 || statuses.length !== 1)
      return NextResponse.redirect(fallback, 303);
    await connectDatabase();
    const code = await finishSandboxPayment(
      reference,
      transids[0],
      statuses[0],
    );
    return NextResponse.redirect(
      code
        ? new URL(`/checkout/payment/${encodeURIComponent(code)}`, origin)
        : fallback,
      303,
    );
  } catch {
    return NextResponse.redirect(fallback, 303);
  }
}
export async function GET(
  request: Request,
  context: { params: Promise<{ reference: string }> },
) {
  return handle(request, context);
}
export async function POST(
  request: Request,
  context: { params: Promise<{ reference: string }> },
) {
  return handle(request, context);
}
