import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/identity/guards";
import { StorefrontShell } from "@/storefront/storefront-shell";
import { CustomerAccount } from "@/storefront/account/customer-account";
import { AccountShell } from "@/storefront/account/account-shell";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "اطلاعات شخصی | بهارمز",
  robots: { index: false, follow: false },
};
export default async function PersonalPage() {
  try {
    await requirePrincipal("customer");
  } catch {
    redirect("/");
  }
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content" tabIndex={-1}>
        <AccountShell>
          <CustomerAccount />
        </AccountShell>
      </main>
    </StorefrontShell>
  );
}
