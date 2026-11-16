import { redirect } from "next/navigation";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
import { AdminShell } from "@/admin/admin-shell";
import { adminLinks } from "@/admin/navigation";
import { AdminAccount } from "@/admin/admin-account";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "حساب مدیر | بهارمز",
  robots: { index: false, follow: false },
};
export default async function AdminAccountPage() {
  try {
    await requirePrincipal("admin");
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/admin/login");
    throw error;
  }
  return (
    <AdminShell links={adminLinks} currentPath="/admin/account">
      <AdminAccount />
    </AdminShell>
  );
}
