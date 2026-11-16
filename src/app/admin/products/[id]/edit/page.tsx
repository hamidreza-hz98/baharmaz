import { redirect } from "next/navigation";
import { AdminShell } from "@/admin/admin-shell";
import { adminLinks } from "@/admin/navigation";
import { ProductForm } from "@/admin/products/product-form";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "ویرایش محصول | مدیریت بهارمز",
  robots: { index: false, follow: false },
};
export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    await requirePrincipal("admin");
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/admin/login");
    throw error;
  }
  const { id } = await params;
  return (
    <AdminShell links={adminLinks} currentPath="/admin/products">
      <ProductForm productId={id} />
    </AdminShell>
  );
}
