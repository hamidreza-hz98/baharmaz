import type { ShopIntroduction } from "@/modules/shop/introduction";
import { StorefrontShell } from "@/storefront/storefront-shell";
export function ShopIntroductionView({
  introduction,
}: {
  introduction: ShopIntroduction;
}) {
  return (
    <StorefrontShell>
      <main id="main-content" tabIndex={-1} className="store-content">
        <h1>{introduction.name}</h1>
        <p>{introduction.message}</p>
      </main>
    </StorefrontShell>
  );
}
