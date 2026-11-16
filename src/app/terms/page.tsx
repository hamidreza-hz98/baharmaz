import { ArticlePage } from "@/storefront/content/article-page";
import { contentPage, metadataFor } from "@/server/content/pages";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  return metadataFor(await contentPage(), "terms");
}
export default async function TermsPage() {
  const { terms } = await contentPage();
  return (
    <ArticlePage
      title={terms.title || "قوانین و شرایط"}
      description={terms.description}
      items={terms.items}
      empty="قوانین و شرایط هنوز ثبت نشده است."
    />
  );
}
