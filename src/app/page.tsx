import Link from "next/link";
import { StorefrontShell } from "@/storefront/storefront-shell";
import { Hero } from "@/storefront/content/hero";
import { CatalogImage } from "@/storefront/catalog/catalog-image";
import { ProductCard } from "@/storefront/catalog/product-card";
import { contentPage, metadataFor } from "@/server/content/pages";
import { homeCatalog } from "@/server/public-catalog/catalog";
import { absolutePublicUrl } from "@/server/config/public-origin";
import { safeJsonLd } from "@/server/content/structured-data";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return metadataFor(await contentPage(), "home");
}
export default async function Home() {
  const [content, catalog] = await Promise.all([contentPage(), homeCatalog()]);
  const home = content.homepage;
  const canonical = absolutePublicUrl("/");
  return (
    <StorefrontShell>
      {canonical && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "بهارمز",
              url: canonical,
            }),
          }}
        />
      )}
      <main id="main-content" tabIndex={-1} className="store-content home-page">
        <Hero
          banners={home.banners}
          slogan={home.slogans.find((x) => x.text)?.text || ""}
        />
        <section>
          <div className="section-heading">
            <h2>دسته‌بندی محصولات</h2>
            <Link href="/products">همه محصولات</Link>
          </div>
          {catalog.categories.length ? (
            <div className="home-category-grid">
              {catalog.categories.map((category) => (
                <Link
                  className="home-category"
                  key={category.id}
                  href={`/categories/${encodeURIComponent(category.slug)}`}
                >
                  <div className="home-category-image">
                    <CatalogImage id={category.imageId} alt="" />
                  </div>
                  <strong>{category.name}</strong>
                </Link>
              ))}
            </div>
          ) : (
            <p>هنوز دسته‌بندی‌ای ثبت نشده است.</p>
          )}
        </section>
        <section>
          <div className="section-heading">
            <h2>پیشنهادهای ویژه</h2>
            <Link href="/products">مشاهده محصولات</Link>
          </div>
          {catalog.products.length ? (
            <div className="catalog-grid">
              {catalog.products.map((product) => (
                <ProductCard key={product.id} item={product} />
              ))}
            </div>
          ) : (
            <p>در حال حاضر پیشنهاد ویژه‌ای ثبت نشده است.</p>
          )}
        </section>
        {home.slogans.length > 1 && (
          <section className="home-slogans" aria-label="سخن بهارمز">
            {home.slogans
              .slice(1)
              .filter((x) => x.text)
              .map((x) => (
                <p key={x.id}>{x.text}</p>
              ))}
          </section>
        )}
        <section className="home-about">
          <div>
            <h2>{home.aboutTitle || "درباره بهارمز"}</h2>
            <p className="content-text">
              {home.aboutText ||
                "اطلاعات بیشتر درباره بهارمز به‌زودی اینجا قرار می‌گیرد."}
            </p>
            <Link href="/about">بیشتر درباره ما</Link>
          </div>
          {home.aboutImageId && (
            <div className="home-category-image">
              <CatalogImage id={home.aboutImageId} />
            </div>
          )}
        </section>
      </main>
    </StorefrontShell>
  );
}
