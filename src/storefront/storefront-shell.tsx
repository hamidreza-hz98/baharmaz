import Link from "next/link";
import { BrandLogo } from "./brand-logo";
import { CustomerAuthDialog } from "./auth/customer-auth-dialog";
import { StoreNavigation } from "./store-navigation";

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="store-shell">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>
      <header className="store-header">
        <div className="store-header-inner">
          <Link className="store-brand" href="/" aria-label="بهارمز، صفحه اصلی">
            <BrandLogo size={56} />
            <span>بهارمز</span>
          </Link>
          <StoreNavigation />
          <CustomerAuthDialog />
        </div>
      </header>
      {children}
      <footer className="store-footer">
        <div className="store-footer-inner">
          <Link
            className="store-footer-logo"
            href="/"
            aria-label="بهارمز، صفحه اصلی"
          >
            <BrandLogo size={180} full />
          </Link>
          <nav aria-label="پیوندهای پانوشت">
            <Link href="/">خانه</Link>
            {" · "}
            <Link href="/about">درباره ما</Link>
            {" · "}
            <Link href="/contact">تماس با ما</Link>
            {" · "}
            <Link href="/faq">پرسش‌های متداول</Link>
            {" · "}
            <Link href="/terms">قوانین و شرایط</Link>
            {" · "}
            <Link href="/account">حساب کاربری</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
