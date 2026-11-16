import { NextResponse } from "next/server";
import { connectDatabase } from "@/server/database/connection";
import { readContent } from "@/server/content/settings";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await connectDatabase();
    const { content } = await readContent();
    return NextResponse.json(
      { content },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "دریافت اطلاعات ممکن نشد." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
