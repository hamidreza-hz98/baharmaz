import { CatalogList } from "@/storefront/catalog/catalog-list";
export default function Preview() {
  return (
    <main>
      <CatalogList
        categories={[
          { id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "غذا", slug: "غذا" },
        ]}
      />
      <footer>پانوشت فروشگاه</footer>
    </main>
  );
}
