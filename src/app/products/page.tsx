import { StorefrontShell } from "@/storefront/storefront-shell";
import { CatalogList } from "@/storefront/catalog/catalog-list";
import { categories } from "@/server/public-catalog/catalog";
import { contentPage, metadataFor } from "@/server/content/pages";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return metadataFor(await contentPage(), "products");
}
export default async function ProductsPage() {
  const list = await categories();
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content catalog-page">
        <h1>محصولات بهارمز</h1>
        <p>محصول مورد علاقه‌تان را پیدا کنید.</p>
        <CatalogList categories={list} />
      </main>
    </StorefrontShell>
  );
}
