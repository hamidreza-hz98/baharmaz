import { StorefrontShell } from "@/storefront/storefront-shell";
import { CartView } from "@/storefront/cart/cart-view";
export const metadata = {
  title: "سبد خرید | بهارمز",
  robots: { index: false, follow: false },
};
export default function CartPage() {
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content">
        <CartView />
      </main>
    </StorefrontShell>
  );
}
