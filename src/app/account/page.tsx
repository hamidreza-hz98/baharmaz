import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/identity/guards";
import { StorefrontShell } from "@/storefront/storefront-shell";
import { AccountShell } from "@/storefront/account/account-shell";
import { OrderHistory } from "@/storefront/account/order-history";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "سفارش‌های من | بهارمز",
  robots: { index: false, follow: false },
};
export default async function AccountPage() {
  try {
    await requirePrincipal("customer");
  } catch {
    redirect("/");
  }
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content" tabIndex={-1}>
        <AccountShell>
          <OrderHistory />
        </AccountShell>
      </main>
    </StorefrontShell>
  );
}
