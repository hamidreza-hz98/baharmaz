import { redirect } from "next/navigation";
import { AdminShell } from "@/admin/admin-shell";
import { adminLinks } from "@/admin/navigation";
import { CatalogAdmin } from "@/admin/catalog/catalog-admin";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "مواد اولیه | مدیریت بهارمز",
  robots: { index: false, follow: false },
};
export default async function IngredientsPage() {
  try {
    await requirePrincipal("admin");
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/admin/login");
    throw error;
  }
  return (
    <AdminShell links={adminLinks} currentPath="/admin/ingredients">
      <CatalogAdmin kind="ingredients" />
    </AdminShell>
  );
}
