import { redirect } from "next/navigation";
import { AdminShell } from "@/admin/admin-shell";
import { adminLinks } from "@/admin/navigation";
import { ManualOrder } from "@/admin/manual-order";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "پیش‌نمایش سفارش دستی | مدیریت بهارمز",
  robots: { index: false, follow: false },
};
export default async function Page() {
  try {
    await requirePrincipal("admin");
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/admin/login");
    throw error;
  }
  return (
    <AdminShell links={adminLinks} currentPath="/admin/orders">
      <ManualOrder />
    </AdminShell>
  );
}
