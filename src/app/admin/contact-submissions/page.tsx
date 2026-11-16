import { redirect } from "next/navigation";
import { AdminShell } from "@/admin/admin-shell";
import { adminLinks } from "@/admin/navigation";
import { ContactSubmissions } from "@/admin/contact-submissions";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "پیام‌های تماس | مدیریت بهارمز",
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
    <AdminShell links={adminLinks} currentPath="/admin/contact-submissions">
      <ContactSubmissions />
    </AdminShell>
  );
}
