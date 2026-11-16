import { redirect } from "next/navigation";
import { AdminShell } from "@/admin/admin-shell";
import { adminLinks } from "@/admin/navigation";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { Dashboard } from "@/admin/dashboard";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "مدیریت | بهارمز",
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
    <AdminShell links={adminLinks} currentPath="/admin">
      <Dashboard />
    </AdminShell>
  );
}
