import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/identity/guards";
import { StorefrontShell } from "@/storefront/storefront-shell";
import { AccountShell } from "@/storefront/account/account-shell";
import { OrderDetails } from "@/storefront/account/order-details";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "جزئیات سفارش | بهارمز",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  try {
    await requirePrincipal("customer");
  } catch {
    redirect("/");
  }
  const { code } = await params;
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content">
        <AccountShell>
          <OrderDetails code={code} />
        </AccountShell>
      </main>
    </StorefrontShell>
  );
}
