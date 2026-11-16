import { ArticlePage } from "@/storefront/content/article-page";
import { contentPage, metadataFor } from "@/server/content/pages";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return metadataFor(await contentPage(), "faq");
}
export default async function FaqPage() {
  const { faq } = await contentPage();
  return (
    <ArticlePage
      title={faq.title || "پرسش‌های متداول"}
      description={faq.description}
      items={faq.items}
      empty="هنوز پرسشی ثبت نشده است."
    />
  );
}
