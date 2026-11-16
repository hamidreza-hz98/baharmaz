import { LoadingState } from "@/shared/ui/primitives";
import { StorefrontShell } from "@/storefront/storefront-shell";
export default function Loading() {
  return (
    <StorefrontShell>
      <main id="main-content" tabIndex={-1} className="store-content">
        <LoadingState />
      </main>
    </StorefrontShell>
  );
}
