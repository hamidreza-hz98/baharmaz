import "server-only";
import mongoose, { Schema } from "mongoose";
import {
  contentSections,
  staticPages,
  type ContentSection,
  type ContentSettings,
  type SiteContentSettings,
  type StaticSeoSettings,
} from "../../shared/content.ts";
import { getMedia } from "../media/storage.ts";
import {
  CatalogWriteBusy,
  withCatalogReferenceLock,
} from "../catalog/reference-lock.ts";

const schema = new Schema(
  {
    _id: String,
    revision: { type: Number, default: 0 },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { versionKey: false, timestamps: true, autoIndex: false },
);
export const ContentDocument =
  mongoose.models.ContentSettings || mongoose.model("ContentSettings", schema);
export class ContentConflict extends Error {}
type Obj = Record<string, unknown>;
function object(
  value: unknown,
  allowed: readonly string[],
  strict: boolean,
): Obj {
  if (value === undefined && !strict) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (strict) throw new RangeError("Invalid object");
    return {};
  }
  const result = value as Obj;
  if (strict && Object.keys(result).some((key) => !allowed.includes(key)))
    throw new RangeError("Unknown field");
  return result;
}
function text(value: unknown, max: number, strict: boolean): string {
  if (value === undefined && !strict) return "";
  if (typeof value !== "string") {
    if (strict) throw new RangeError("Invalid text");
    return "";
  }
  const v = value.trim().normalize("NFKC");
  if (
    v.length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v)
  ) {
    if (strict) throw new RangeError("Invalid text");
    return "";
  }
  return v;
}
function image(value: unknown, strict: boolean): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "string" && /^[a-f\d]{24}$/i.test(value))
    return value.toLowerCase();
  if (strict) throw new RangeError("Invalid image");
  return null;
}
function safeUrl(value: unknown, strict: boolean, internal: boolean): string {
  const v = text(value, 2048, strict);
  if (!v) return "";
  try {
    if (
      internal &&
      v.startsWith("/") &&
      !v.startsWith("//") &&
      !v.includes("\\") &&
      !/[\u0000-\u0020\u007f]/.test(v)
    )
      return v;
    if (!internal) {
      const url = new URL(v);
      if (url.protocol === "https:" && !url.username && !url.password)
        return url.toString();
    }
  } catch {
    /* invalid URL */
  }
  if (strict) throw new RangeError("Invalid URL");
  return "";
}
function array<T>(
  value: unknown,
  max: number,
  strict: boolean,
  parse: (entry: unknown) => T,
): T[] {
  if (value === undefined && !strict) return [];
  if (!Array.isArray(value) || value.length > max) {
    if (strict) throw new RangeError("Invalid list");
    return [];
  }
  const output: T[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    try {
      const item = parse(entry);
      const id = (item as { id: string }).id;
      if (!id || ids.has(id)) throw new RangeError("Invalid id");
      ids.add(id);
      output.push(item);
    } catch (error) {
      if (strict) throw error;
    }
  }
  return output;
}
function entryId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9_-]{1,64}$/i.test(value))
    throw new RangeError("Invalid id");
  return value;
}
function sections(value: unknown, strict: boolean): ContentSettings {
  const root = object(
    value,
    ["homepage", "contact", "faq", "terms", "about", "seo"],
    strict,
  );
  const h = object(
    root.homepage,
    ["banners", "slogans", "aboutTitle", "aboutText", "aboutImageId"],
    strict,
  );
  const c = object(
    root.contact,
    ["phones", "socials", "address", "mapUrl"],
    strict,
  );
  function article(input: unknown) {
    const a = object(input, ["title", "description", "items"], strict);
    return {
      title: text(a.title, 160, strict),
      description: text(a.description, 2000, strict),
      items: array(a.items, 100, strict, (e) => {
        const x = object(e, ["id", "title", "body"], strict);
        return {
          id: entryId(x.id),
          title: text(x.title, 250, strict),
          body: text(x.body, 10000, strict),
        };
      }),
    };
  }
  const a = object(root.about, ["title", "body", "imageId"], strict);
  const seo = object(root.seo, staticPages, strict);
  return {
    homepage: {
      banners: array(h.banners, 30, strict, (e) => {
        const x = object(e, ["id", "imageId", "href", "alt"], strict);
        return {
          id: entryId(x.id),
          imageId: image(x.imageId, strict),
          href: safeUrl(x.href, strict, true),
          alt: text(x.alt, 200, strict),
        };
      }),
      slogans: array(h.slogans, 30, strict, (e) => {
        const x = object(e, ["id", "text"], strict);
        return { id: entryId(x.id), text: text(x.text, 200, strict) };
      }),
      aboutTitle: text(h.aboutTitle, 160, strict),
      aboutText: text(h.aboutText, 10000, strict),
      aboutImageId: image(h.aboutImageId, strict),
    },
    contact: {
      phones: array(c.phones, 20, strict, (e) => {
        const x = object(e, ["id", "value"], strict);
        const value = text(x.value, 40, strict);
        if (value && !/^[+\d۰-۹٠-٩()\-\s]+$/.test(value))
          throw new RangeError("Invalid phone");
        return { id: entryId(x.id), value };
      }),
      socials: array(c.socials, 20, strict, (e) => {
        const x = object(e, ["id", "label", "url"], strict);
        return {
          id: entryId(x.id),
          label: text(x.label, 80, strict),
          url: safeUrl(x.url, strict, false),
        };
      }),
      address: text(c.address, 1000, strict),
      mapUrl: safeUrl(c.mapUrl, strict, false),
    },
    faq: article(root.faq),
    terms: article(root.terms),
    about: {
      title: text(a.title, 160, strict),
      body: text(a.body, 20000, strict),
      imageId: image(a.imageId, strict),
    },
    seo: Object.fromEntries(
      staticPages.map((page) => {
        const s = object(seo[page], ["title", "description"], strict);
        return [
          page,
          {
            title: text(s.title, 160, strict),
            description: text(s.description, 320, strict),
          },
        ];
      }),
    ) as ContentSettings["seo"],
  };
}
export function publicContent(value: unknown): ContentSettings {
  return sections(value, false);
}
export function validateContent(value: unknown): ContentSettings {
  return sections(value, true);
}
function revisionOf(value: unknown): number {
  if (
    value &&
    typeof value === "object" &&
    "revision" in value &&
    Number.isSafeInteger(value.revision) &&
    (value.revision as number) >= 0
  )
    return value.revision as number;
  return 0;
}
function valueAt(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}
const sectionDocumentId = (section: ContentSection) => `site-${section}`;
const seoDocumentId = "site-seo";

export function validateContentSection(
  section: ContentSection,
  value: unknown,
): SiteContentSettings[ContentSection] {
  if (!contentSections.includes(section)) throw new RangeError("Invalid section");
  const base = publicContent({});
  const result = sections(
    { ...base, [section]: value === undefined ? base[section] : value },
    true,
  );
  return result[section];
}

export function validateStaticSeo(value: unknown): StaticSeoSettings {
  const base = publicContent({});
  return sections({ ...base, seo: value === undefined ? base.seo : value }, true)
    .seo;
}

export async function readContentSection(section: ContentSection) {
  if (!contentSections.includes(section)) throw new RangeError("Invalid section");
  const [record, legacy] = await Promise.all([
    ContentDocument.findById(sectionDocumentId(section)).lean(),
    ContentDocument.findById("site").lean(),
  ]);
  const storedValue = valueAt(record?.data, "value");
  const legacyValue = valueAt(legacy?.data, section);
  return {
    revision: revisionOf(record),
    value: validateContentSection(
      section,
      storedValue === undefined ? legacyValue : storedValue,
    ),
  };
}

export async function readStaticSeo() {
  const [record, legacy] = await Promise.all([
    ContentDocument.findById(seoDocumentId).lean(),
    ContentDocument.findById("site").lean(),
  ]);
  const storedValue = valueAt(record?.data, "value");
  const legacyValue = valueAt(legacy?.data, "seo");
  return {
    revision: revisionOf(record),
    seo: validateStaticSeo(storedValue === undefined ? legacyValue : storedValue),
  };
}

export async function readContent() {
  const legacy = await ContentDocument.findById("site").lean();
  const content = publicContent(legacy?.data);
  const records = await ContentDocument.find({
    _id: {
      $in: [...contentSections.map(sectionDocumentId), seoDocumentId],
    },
  }).lean();
  const byId = new Map(records.map((record) => [String(record._id), record]));
  for (const section of contentSections) {
    const stored = valueAt(byId.get(sectionDocumentId(section))?.data, "value");
    if (stored !== undefined)
      Object.assign(content, {
        [section]: validateContentSection(section, stored),
      });
  }
  const seoStored = valueAt(byId.get(seoDocumentId)?.data, "value");
  if (seoStored !== undefined) content.seo = validateStaticSeo(seoStored);
  return { revision: revisionOf(legacy), content };
}

async function writeSettingsDocument(
  id: string,
  value: unknown,
  revision: unknown,
) {
  if (
    typeof revision !== "number" ||
    !Number.isSafeInteger(revision) ||
    revision < 0
  )
    throw new RangeError("Invalid revision");
  try {
    const filter =
      revision === 0
        ? {
            _id: id,
            $or: [{ revision: 0 }, { revision: { $exists: false } }],
          }
        : { _id: id, revision };
    const updated = await ContentDocument.findOneAndUpdate(
      filter,
      { $set: { data: { value } }, $inc: { revision: 1 } },
      { upsert: revision === 0, new: true, setDefaultsOnInsert: false },
    ).lean();
    if (!updated) throw new ContentConflict();
    return { revision: updated.revision as number, value };
  } catch (error) {
    if (
      error instanceof ContentConflict ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000)
    )
      throw new ContentConflict();
    throw error;
  }
}

export async function saveContentSection(
  section: ContentSection,
  value: unknown,
  revision: unknown,
) {
  try {
    return await withCatalogReferenceLock(async () => {
      const validated = validateContentSection(section, value);
      const imageIds =
        section === "homepage"
          ? [
              (validated as SiteContentSettings["homepage"]).aboutImageId,
              ...(validated as SiteContentSettings["homepage"]).banners.map(
                (banner) => banner.imageId,
              ),
            ]
          : section === "about"
            ? [(validated as SiteContentSettings["about"]).imageId]
            : [];
      for (const id of new Set(imageIds.filter((id): id is string => !!id))) {
        const media = await getMedia(id);
        if (
          !media ||
          media.file.metadata?.kind !== "image" ||
          media.file.metadata?.contentType !== "image/webp"
        )
          throw new RangeError("Invalid image");
      }
      const result = await writeSettingsDocument(
        sectionDocumentId(section),
        validated,
        revision,
      );
      return { revision: result.revision, value: validated };
    });
  } catch (error) {
    if (error instanceof CatalogWriteBusy) throw new ContentConflict();
    throw error;
  }
}

export async function saveStaticSeo(value: unknown, revision: unknown) {
  const validated = validateStaticSeo(value);
  const result = await writeSettingsDocument(seoDocumentId, validated, revision);
  return { revision: result.revision, seo: validated };
}
