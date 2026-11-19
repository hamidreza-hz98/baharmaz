"use client";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import { notifyCustomerChanged } from "@/storefront/auth/customer-name";
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
      notifyCustomerChanged();
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
    { href: "/account", label: "سفارش‌های من", icon: ReceiptLongIcon },
    {
      href: "/account/personal",
      label: "اطلاعات شخصی",
      icon: AccountCircleOutlinedIcon,
    },
    {
      href: "/account/addresses",
      label: "نشانی‌های من",
      icon: LocationOnOutlinedIcon,
    },
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
              <link.icon aria-hidden="true" />
              {link.label}
            </Link>
          ))}
        </nav>
        <button
          className="profile-logout"
          type="button"
          disabled={busy}
          onClick={() => void logout()}
        >
          <LogoutIcon aria-hidden="true" />
          {busy ? "در حال خروج…" : "خروج از حساب"}
        </button>
        {error && <p role="alert">{error}</p>}
      </aside>
      <div className="profile-main">{children}</div>
    </div>
  );
}
