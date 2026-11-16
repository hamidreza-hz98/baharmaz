import Link from "next/link";
import { StorefrontShell } from "@/storefront/storefront-shell";
export default function NotFound() {
  return (
    <StorefrontShell>
      <main id="main-content" tabIndex={-1} className="store-content">
        <section className="page-message">
          <h1>صفحه پیدا نشد</h1>
          <p>نشانی را بررسی کنید یا به صفحه اصلی بازگردید.</p>
          <Link href="/">بازگشت به صفحه اصلی</Link>
        </section>
      </main>
    </StorefrontShell>
  );
}
