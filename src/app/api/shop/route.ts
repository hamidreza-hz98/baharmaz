import { loadShopIntroduction } from "@/server/shop/load-introduction";
import { internalError, success } from "@/shared/api-result";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return Response.json(success(await loadShopIntroduction()), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(internalError(), { status: 500 });
  }
}
