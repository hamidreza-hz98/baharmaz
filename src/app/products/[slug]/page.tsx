import Link from "next/link";
import { notFound } from "next/navigation";
import { productBySlug } from "@/server/public-catalog/catalog";
import { StorefrontShell } from "@/storefront/storefront-shell";
import { Gallery } from "@/storefront/catalog/gallery";
import { CatalogImage } from "@/storefront/catalog/catalog-image";
import { Price } from "@/storefront/catalog/product-card";
import { AddToCart } from "@/storefront/catalog/add-to-cart";
import { absolutePublicUrl } from "@/server/config/public-origin";
import {
  isRichDescription,
  RICH_DESCRIPTION_PREFIX,
} from "@/shared/rich-description";
import { sanitizeRichDescription } from "@/server/products/rich-description";
import { safeJsonLd } from "@/server/content/structured-data";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const p = await productBySlug(slug);
  const canonical =
    p && absolutePublicUrl(`/products/${encodeURIComponent(p.slug)}`);
  return p
    ? {
        title: `${p.title} | بهارمز`,
        description: (
          p.excerpt || `مشاهده ${p.title} در فروشگاه بهارمز.`
        ).slice(0, 160),
        ...(canonical
          ? { alternates: { canonical } }
          : { robots: { index: false, follow: false } }),
      }
    : {
        title: "محصول یافت نشد | بهارمز",
        robots: { index: false, follow: false },
      };
}
export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const p = await productBySlug(slug);
  if (!p) notFound();
  const canonical = absolutePublicUrl(
    `/products/${encodeURIComponent(p.slug)}`,
  );
  return (
    <StorefrontShell>
      {canonical && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              "@context": "https://schema.org",
              "@type": "Product",
              name: p.title,
              url: canonical,
              ...(p.excerpt ? { description: p.excerpt } : {}),
            }),
          }}
        />
      )}
      <main id="main-content" className="store-content catalog-page">
        <nav aria-label="مسیر صفحه">
          <Link href="/products">محصولات</Link> /{" "}
          <Link href={`/categories/${encodeURIComponent(p.category.slug)}`}>
            {p.category.name}
          </Link>{" "}
          / {p.title}
        </nav>
        <div className="catalog-detail">
          <Gallery images={p.gallery} title={p.title} />
          <div>
            <h1>{p.title}</h1>
            {p.promoted && <p>پیشنهاد ویژه</p>}
            {p.excerpt && <p>{p.excerpt}</p>}
            <Price item={p} />
            <p>{p.available ? "موجود" : "در حال حاضر ناموجود"}</p>
            <AddToCart id={p.id} available={p.available} />
          </div>
        </div>
        <section>
          <h2>توضیحات محصول</h2>
          {isRichDescription(p.description) ? (
            <div
              className="catalog-description rich-description"
              dir="rtl"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichDescription(p.description).slice(
                  RICH_DESCRIPTION_PREFIX.length,
                ),
              }}
            />
          ) : (
            <p className="catalog-description">
              {p.description || "توضیحی برای این محصول ثبت نشده است."}
            </p>
          )}
        </section>
        <section>
          <h2>مواد اولیه</h2>
          {p.ingredients.length ? (
            <ul className="product-ingredients">
              {p.ingredients.map((ingredient) => (
                <li key={ingredient.name}>
                  {ingredient.iconId && (
                    <CatalogImage id={ingredient.iconId} alt="" />
                  )}
                  <span>{ingredient.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              اطلاعات مواد اولیه ثبت نشده است؛ برای جزئیات با فروشگاه تماس
              بگیرید.
            </p>
          )}
        </section>
      </main>
    </StorefrontShell>
  );
}
