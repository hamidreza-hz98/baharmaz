import { pingDatabase } from "@/server/database/connection";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    await pingDatabase();
    return Response.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "not_ready" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
