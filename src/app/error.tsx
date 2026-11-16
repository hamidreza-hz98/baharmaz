"use client";
import { ErrorState } from "@/shared/ui/primitives";
import { StorefrontShell } from "@/storefront/storefront-shell";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <StorefrontShell>
      <main id="main-content" tabIndex={-1} className="store-content">
        <ErrorState onRetry={reset} />
      </main>
    </StorefrontShell>
  );
}
