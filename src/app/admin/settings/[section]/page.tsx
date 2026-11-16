import { redirect } from "next/navigation";
import { AdminShell } from "@/admin/admin-shell";
import { adminLinks } from "@/admin/navigation";
import { ContentSettingsEditor } from "@/admin/content-settings";
import { SeoSettingsEditor } from "@/admin/seo-settings";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import type { ContentSection } from "@/shared/content";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "تنظیمات فروشگاه | بهارمز",
  robots: { index: false, follow: false },
};

const sections = new Set<string>([
  "homepage",
  "contact",
  "faq",
  "terms",
  "about",
  "seo",
]);

export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  try {
    await requirePrincipal("admin");
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/admin/login");
    throw error;
  }
  const { section } = await params;
  if (!sections.has(section)) redirect("/admin/settings/homepage");
  const currentPath = `/admin/settings/${section}`;
  return (
    <AdminShell links={adminLinks} currentPath={currentPath}>
      {section === "seo" ? (
        <SeoSettingsEditor />
      ) : (
        <ContentSettingsEditor section={section as ContentSection} />
      )}
    </AdminShell>
  );
}
