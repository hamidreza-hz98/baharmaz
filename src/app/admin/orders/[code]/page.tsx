import { redirect } from "next/navigation";
import { AdminShell } from "@/admin/admin-shell";
import { adminLinks } from "@/admin/navigation";
import { OrderManagementDetail } from "@/admin/orders";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "جزئیات سفارش | مدیریت بهارمز",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  try {
    await requirePrincipal("admin");
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/admin/login");
    throw error;
  }
  const { code } = await params;
  return (
    <AdminShell links={adminLinks} currentPath="/admin/orders">
      <OrderManagementDetail code={code} />
    </AdminShell>
  );
}
