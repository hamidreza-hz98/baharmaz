import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/identity/guards";
import { StorefrontShell } from "@/storefront/storefront-shell";
import { CheckoutSteps } from "@/storefront/checkout/checkout-steps";
import { AddressSelector } from "@/storefront/checkout/address-selector";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "انتخاب نشانی | بهارمز",
  robots: { index: false, follow: false },
};
export default async function CheckoutAddressPage() {
  try {
    await requirePrincipal("customer");
  } catch {
    redirect("/cart");
  }
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content">
        <CheckoutSteps current="address" />
        <AddressSelector />
      </main>
    </StorefrontShell>
  );
}
