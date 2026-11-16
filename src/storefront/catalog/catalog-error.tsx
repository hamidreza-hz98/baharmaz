"use client";
import { StorefrontShell } from "@/storefront/storefront-shell";
export default function CatalogError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StorefrontShell>
      <main id="main-content" className="store-content page-message">
        <h1>دریافت اطلاعات ممکن نشد</h1>
        <p>لطفاً دوباره تلاش کنید.</p>
        <button className="catalog-button" onClick={reset}>
          تلاش دوباره
        </button>
      </main>
    </StorefrontShell>
  );
}
