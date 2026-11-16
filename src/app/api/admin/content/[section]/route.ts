import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { validMutationOrigin, readJsonObject } from "@/server/account/request";
import { contentSections, type ContentSection } from "@/shared/content";
import {
  ContentConflict,
  readContentSection,
  saveContentSection,
} from "@/server/content/settings";

export const dynamic = "force-dynamic";
const reply = (data: object, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
const sectionFrom = (value: string): ContentSection | null =>
  contentSections.includes(value as ContentSection)
    ? (value as ContentSection)
    : null;
function fail(error: unknown) {
  if (error instanceof UnauthorizedError)
    return reply({ error: "دسترسی امکان‌پذیر نیست." }, 401);
  if (error instanceof ContentConflict)
    return reply({ error: "این بخش تغییر کرده است؛ نسخه جدید را دریافت کنید." }, 409);
  if (error instanceof RangeError || error instanceof SyntaxError)
    return reply({ error: "اطلاعات این بخش معتبر نیست." }, 400);
  return reply({ error: "دریافت یا ذخیره این بخش ممکن نشد." }, 500);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  try {
    await requirePrincipal("admin");
    const { section: raw } = await params;
    const section = sectionFrom(raw);
    if (!section) return reply({ error: "بخش تنظیمات پیدا نشد." }, 404);
    return reply(await readContentSection(section));
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  if (!validMutationOrigin(request))
    return reply({ error: "درخواست معتبر نیست." }, 403);
  try {
    await requirePrincipal("admin");
    const { section: raw } = await params;
    const section = sectionFrom(raw);
    if (!section) return reply({ error: "بخش تنظیمات پیدا نشد." }, 404);
    const input = await readJsonObject(request, 1024 * 1024);
    if (Object.keys(input).some((key) => !["revision", "value"].includes(key)))
      throw new RangeError("Unknown field");
    const result = await saveContentSection(
      section,
      input.value,
      input.revision,
    );
    const paths: Record<ContentSection, string[]> = {
      homepage: ["/"],
      contact: ["/contact"],
      faq: ["/faq"],
      terms: ["/terms"],
      about: ["/about", "/"],
    };
    for (const path of paths[section]) revalidatePath(path);
    return reply(result);
  } catch (error) {
    return fail(error);
  }
}
