import Link from "next/link";
import { notFound } from "next/navigation";
import { StorefrontShell } from "@/storefront/storefront-shell";
import { CatalogList } from "@/storefront/catalog/catalog-list";
import { categories, categoryBySlug } from "@/server/public-catalog/catalog";
import { absolutePublicUrl } from "@/server/config/public-origin";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const c = await categoryBySlug(slug);
  const canonical =
    c && absolutePublicUrl(`/categories/${encodeURIComponent(c.slug)}`);
  return c
    ? {
        title: `${c.name} | بهارمز`,
        description: (
          c.excerpt || `محصولات دسته‌بندی ${c.name} در فروشگاه بهارمز.`
        ).slice(0, 160),
        ...(canonical
          ? { alternates: { canonical } }
          : { robots: { index: false, follow: false } }),
      }
    : {
        title: "دسته‌بندی یافت نشد | بهارمز",
        robots: { index: false, follow: false },
      };
}
export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const [c, all] = await Promise.all([categoryBySlug(slug), categories()]);
  if (!c) notFound();
  const parent = all.find((item) => item.id === c.parentId);
  const children = all.filter((item) => item.parentId === c.id);
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content catalog-page">
        <nav aria-label="مسیر صفحه">
          <Link href="/products">محصولات</Link> /{" "}
          {parent && (
            <>
              <Link href={`/categories/${encodeURIComponent(parent.slug)}`}>
                {parent.name}
              </Link>{" "}
              /{" "}
            </>
          )}
          {c.name}
        </nav>
        <h1>{c.name}</h1>
        {c.excerpt && <p>{c.excerpt}</p>}
        {children.length > 0 && (
          <nav aria-label="زیردسته‌ها">
            {children.map((child) => (
              <p key={child.id}>
                <Link href={`/categories/${encodeURIComponent(child.slug)}`}>
                  {child.name}
                </Link>
              </p>
            ))}
          </nav>
        )}
        <CatalogList categories={all} initialCategory={c.id} />
      </main>
    </StorefrontShell>
  );
}
