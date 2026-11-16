import "server-only";
import { connectDatabase } from "@/server/database/connection";
import { readContent } from "@/server/content/settings";
import type { ContentSettings } from "@/shared/content";
import { resolveStaticSeo } from "@/shared/static-seo";
import { staticSeoDefaults } from "@/shared/static-seo";
import { absolutePublicUrl } from "@/server/config/public-origin";
export async function contentPage() {
  await connectDatabase();
  return (await readContent()).content;
}
export function metadataFor(
  content: ContentSettings,
  page: keyof ContentSettings["seo"],
) {
  const seo = resolveStaticSeo(page, content.seo[page]);
  const canonical = absolutePublicUrl(staticSeoDefaults[page].path);
  return {
    title: seo.title,
    description: seo.description,
    ...(canonical
      ? { alternates: { canonical } }
      : { robots: { index: false, follow: false } }),
    openGraph: {
      type: "website" as const,
      siteName: "بهارمز",
      title: seo.title,
      description: seo.description,
      ...(canonical ? { url: canonical } : {}),
    },
    twitter: {
      card: "summary" as const,
      title: seo.title,
      description: seo.description,
    },
  };
}
