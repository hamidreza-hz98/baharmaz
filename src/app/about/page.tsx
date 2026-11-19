import { StorefrontShell } from "@/storefront/storefront-shell";
import { CatalogImage } from "@/storefront/catalog/catalog-image";
import { contentPage, metadataFor } from "@/server/content/pages";
import {
  isRichDescription,
  RICH_DESCRIPTION_PREFIX,
} from "@/shared/rich-description";
import { sanitizeRichDescription } from "@/server/products/rich-description";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return metadataFor(await contentPage(), "about");
}
export default async function AboutPage() {
  const { about } = await contentPage();
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content info-page">
        <h1>{about.title || "درباره ما"}</h1>
        <div className="info-about">
          {about.imageId && (
            <div className="home-category-image">
              <CatalogImage id={about.imageId} />
            </div>
          )}
          {isRichDescription(about.body) ? (
            <div
              className="rich-description"
              dir="rtl"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichDescription(about.body).slice(
                  RICH_DESCRIPTION_PREFIX.length,
                ),
              }}
            />
          ) : (
            <p className="content-text">
              {about.body || "اطلاعات درباره بهارمز هنوز ثبت نشده است."}
            </p>
          )}
        </div>
      </main>
    </StorefrontShell>
  );
}
