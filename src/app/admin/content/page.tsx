import { redirect } from "next/navigation";
import { requirePrincipal, UnauthorizedError } from "@/server/identity/guards";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "تنظیمات صفحه اصلی | بهارمز",
  robots: { index: false, follow: false },
};
export default async function Page() {
  try {
    await requirePrincipal("admin");
  } catch (error) {
    if (error instanceof UnauthorizedError) redirect("/admin/login");
    throw error;
  }
  redirect("/admin/settings/homepage");
}
