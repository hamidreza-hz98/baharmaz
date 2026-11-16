import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/identity/guards";
import { StorefrontShell } from "@/storefront/storefront-shell";
import { OrderReview } from "@/storefront/checkout/order-review";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "بررسی سفارش | بهارمز",
  robots: { index: false, follow: false },
};
export default async function ReviewPage() {
  try {
    await requirePrincipal("customer");
  } catch {
    redirect("/cart");
  }
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content">
        <OrderReview />
      </main>
    </StorefrontShell>
  );
}
