import { redirect } from "next/navigation";
import { AdminShell } from "@/admin/admin-shell";
import { adminLinks } from "@/admin/navigation";
import { OperationalSettings } from "@/admin/operational-settings";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "تنظیمات عملیاتی | مدیریت بهارمز",
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
    <AdminShell links={adminLinks} currentPath="/admin/operational-settings">
      <OperationalSettings />
    </AdminShell>
  );
}
