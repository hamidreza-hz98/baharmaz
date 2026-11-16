import { NextResponse } from "next/server";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { ContactSubmission } from "@/server/contact/contact";
import { normalizeDigits } from "@/shared/locale";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
export async function GET(request: Request) {
  try {
    await requirePrincipal("admin");
    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    if (id !== null) {
      if (!/^[a-f\d]{24}$/i.test(id)) throw new RangeError();
      const row = await ContactSubmission.findById(id)
        .select("name mobile message createdAt")
        .lean();
      if (!row)
        return NextResponse.json(
          { error: "پیام پیدا نشد." },
          { status: 404, headers },
        );
      return NextResponse.json(
        {
          item: {
            id: String(row._id),
            name: row.name,
            mobile: row.mobile,
            message: row.message,
            createdAt: row.createdAt,
          },
        },
        { headers },
      );
    }
    const query = params.get("q") ?? "";
    if (query.length > 120) throw new RangeError();
    const escaped = normalizeDigits(query.trim()).replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    const filter = escaped
      ? {
          $or: [
            { name: { $regex: escaped, $options: "i" } },
            { mobile: { $regex: escaped } },
            { message: { $regex: escaped, $options: "i" } },
          ],
        }
      : {};
    const raw = params.get("page") ?? "1";
    if (!/^[1-9]\d{0,3}$/.test(raw) || Number(raw) > 1000)
      throw new RangeError();
    const page = Number(raw);
    const [rows, total] = await Promise.all([
      ContactSubmission.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * 20)
        .limit(20)
        .select("name mobile message createdAt")
        .lean(),
      ContactSubmission.countDocuments(filter),
    ]);
    return NextResponse.json(
      {
        items: rows.map((x) => ({
          id: String(x._id),
          name: x.name,
          mobile: x.mobile,
          message: x.message,
          createdAt: x.createdAt,
        })),
        total,
        page,
        limit: 20,
      },
      { headers },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof UnauthorizedError
            ? "دسترسی امکان‌پذیر نیست."
            : error instanceof RangeError
              ? "جست‌وجو یا شناسه معتبر نیست."
              : "دریافت پیام‌ها ممکن نشد.",
      },
      {
        status:
          error instanceof UnauthorizedError
            ? 401
            : error instanceof RangeError
              ? 400
              : 503,
        headers,
      },
    );
  }
}
