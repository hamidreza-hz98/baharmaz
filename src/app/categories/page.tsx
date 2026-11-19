import Link from "next/link";
import { StorefrontShell } from "@/storefront/storefront-shell";
import { CatalogImage } from "@/storefront/catalog/catalog-image";
import { categories } from "@/server/public-catalog/catalog";

export const metadata = { title: "دسته‌بندی محصولات | بهارمز" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const items = await categories();
  return (
    <StorefrontShell>
      <main
        id="main-content"
        tabIndex={-1}
        className="store-content categories-page"
      >
        <header className="section-heading">
          <div>
            <h1>دسته‌بندی محصولات</h1>
            <p>محصولات مورد علاقه‌تان را پیدا کنید.</p>
          </div>
        </header>
        <div className="category-directory-grid">
          <Link
            className="category-directory-card all-products-card"
            href="/products"
          >
            <div className="category-directory-image">
              <CatalogImage
                id={items.find((x) => x.imageId)?.imageId ?? null}
                alt=""
              />
            </div>
            <strong>همه محصولات</strong>
          </Link>
          {items.map((category) => (
            <Link
              className="category-directory-card"
              key={category.id}
              href={`/categories/${encodeURIComponent(category.slug)}`}
            >
              <div className="category-directory-image">
                <CatalogImage id={category.imageId} alt="" />
              </div>
              <strong>{category.name}</strong>
            </Link>
          ))}
        </div>
      </main>
    </StorefrontShell>
  );
}
