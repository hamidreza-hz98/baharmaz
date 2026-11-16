import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { publicMapConfig, reverseConfig } from "@/server/address/map-provider";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requirePrincipal("customer");
    return NextResponse.json(
      { map: publicMapConfig(), reverseEnabled: reverseConfig() !== null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "نقشه در دسترس نیست؛ نشانی را دستی وارد کنید." },
      {
        status: error instanceof UnauthorizedError ? 401 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
