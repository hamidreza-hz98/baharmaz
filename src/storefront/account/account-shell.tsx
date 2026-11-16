"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
export function AccountShell({ children }: { children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    if (busy || !window.confirm("از حساب خود خارج می‌شوید؟")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error();
      try {
        sessionStorage.removeItem("lamsechi-checkout-address");
        sessionStorage.removeItem("lamsechi-delivery-quote");
      } catch {}
      router.replace("/");
      router.refresh();
    } catch {
      setError("خروج از حساب ممکن نشد؛ دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }
  const links = [
    { href: "/account", label: "سفارش‌های من" },
    { href: "/account/personal", label: "اطلاعات شخصی" },
    { href: "/account/addresses", label: "نشانی‌های من" },
  ];
  return (
    <div className="profile-layout">
      <aside className="profile-sidebar">
        <h2>حساب کاربری</h2>
        <nav aria-label="منوی حساب کاربری">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={
                pathname === link.href ||
                (link.href === "/account" &&
                  pathname.startsWith("/account/orders/"))
                  ? "page"
                  : undefined
              }
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <button type="button" disabled={busy} onClick={() => void logout()}>
          {busy ? "در حال خروج…" : "خروج از حساب"}
        </button>
        {error && <p role="alert">{error}</p>}
      </aside>
      <div className="profile-main">{children}</div>
    </div>
  );
}
