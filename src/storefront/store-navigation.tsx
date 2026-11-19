/* eslint-disable @next/next/no-img-element -- Category icons are served as processed catalog images. */
"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { Box, Drawer, IconButton } from "@mui/material";
import { cartChangedEvent } from "@/storefront/cart/client";
import { CustomerAuthDialog } from "@/storefront/auth/customer-auth-dialog";
import { useCustomerName } from "@/storefront/auth/customer-name";

const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverPending = () => false;
type CategoryItem = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  iconId: string | null;
  imageId: string | null;
};

const links = [
  { href: "/", label: "خانه", icon: "home" },
  { href: "/categories", label: "دسته‌ها", icon: "categories" },
  { href: "/cart", label: "سبد خرید", icon: "cart", featured: true },
  { href: "/account", label: "حساب من", icon: "profile" },
  { href: "/contact", label: "تماس", icon: "contact" },
];

function NavIcon({ name }: { name: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "home")
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
      </svg>
    );
  if (name === "categories")
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <rect x="3" y="3" width="8" height="8" rx="2" />
        <rect x="13" y="3" width="8" height="8" rx="2" />
        <rect x="3" y="13" width="8" height="8" rx="2" />
        <rect x="13" y="13" width="8" height="8" rx="2" />
      </svg>
    );
  if (name === "cart")
    return (
      <svg viewBox="0.5 0.5 24 24" {...common}>
        <path d="M3 4h2l2.2 11.1a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L22 8H6" />
        <circle cx="10" cy="20" r="1" />
        <circle cx="18" cy="20" r="1" />
      </svg>
    );
  if (name === "profile")
    return (
      <svg viewBox="0 0 24 24" {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M4 5h16v12H8l-4 3z" />
      <path d="M8 9h8m-8 4h5" />
    </svg>
  );
}

function DrawerIcon({ name }: { name: string }) {
  const props = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  if (name === "home")
    return (
      <svg {...props}>
        <path d="m3 10 9-7 9 7v10H4V10m5 10v-7h6v7" />
      </svg>
    );
  if (name === "products")
    return (
      <svg {...props}>
        <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8m-9 5v9" />
      </svg>
    );
  if (name === "category")
    return (
      <svg {...props}>
        <path d="M4 4h7l9 9-7 7-9-9V4Z" />
        <circle cx="8" cy="8" r="1" />
      </svg>
    );
  if (name === "about")
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5m0-8h.01" />
      </svg>
    );
  if (name === "contact")
    return (
      <svg {...props}>
        <path d="M4 5h16v12H8l-4 3V5Z" />
        <path d="M8 9h8m-8 4h5" />
      </svg>
    );
  if (name === "faq")
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-1.2 1-1.7 1.3-1.7 2.7m0 3h.01" />
      </svg>
    );
  if (name === "terms")
    return (
      <svg {...props}>
        <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7" />
      </svg>
    );
  return (
    <svg {...props}>
      <path d="M3 4h2l2.2 11a2 2 0 0 0 2 1.6h8.9a2 2 0 0 0 2-1.6L22 8H6" />
      <circle cx="10" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  );
}

export function StoreNavigation() {
  const customerName = useCustomerName();
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [accountChecking, setAccountChecking] = useState(false);
  const [accountError, setAccountError] = useState(false);
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientReady,
    serverPending,
  );
  const pathname = usePathname();
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  async function openAccount() {
    if (accountChecking) return;
    setAccountChecking(true);
    setAccountError(false);
    try {
      const response = await fetch("/api/account", { cache: "no-store" });
      if (response.ok) router.push("/account");
      else if (response.status === 401) setAuthOpen(true);
      else setAccountError(true);
    } catch {
      setAccountError(true);
    } finally {
      setAccountChecking(false);
    }
  }
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void fetch("/api/cart", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : Promise.reject()))
        .then((cart: { items?: { quantity?: number }[] }) => {
          if (active) {
            setCartCount(
              (cart.items ?? []).reduce(
                (sum, item) =>
                  sum +
                  (Number.isInteger(item.quantity)
                    ? Math.max(0, item.quantity ?? 0)
                    : 0),
                0,
              ),
            );
          }
        })
        .catch(() => {});
    };
    const onCartChanged = (event: Event) => {
      const cart = (event as CustomEvent<{ items?: { quantity?: number }[] }>)
        .detail;
      if (!cart?.items) return refresh();
      setCartCount(
        cart.items.reduce(
          (sum, item) =>
            sum +
            (Number.isInteger(item.quantity)
              ? Math.max(0, item.quantity ?? 0)
              : 0),
          0,
        ),
      );
    };
    refresh();
    window.addEventListener(cartChangedEvent, onCartChanged);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener(cartChangedEvent, onCartChanged);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  useEffect(() => {
    let active = true;
    void fetch("/api/categories", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((data: { items?: CategoryItem[] }) => {
        if (active) setCategories(data.items ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setCategoriesLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <>
      <nav className="store-desktop-nav" aria-label="منوی اصلی">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          خانه
        </Link>
        <Link
          href="/products"
          aria-current={pathname.startsWith("/products") ? "page" : undefined}
        >
          همه محصولات
        </Link>
        {categories
          .filter((category) => !category.parentId)
          .map((category) => {
            const children = categories.filter(
              (item) => item.parentId === category.id,
            );
            return (
              <div className="store-category-menu" key={category.id}>
                <Link
                  href={`/categories/${encodeURIComponent(category.slug)}`}
                  aria-current={
                    pathname === `/categories/${category.slug}`
                      ? "page"
                      : undefined
                  }
                >
                  {category.name}
                  {children.length > 0 && (
                    <span className="store-category-chevron" aria-hidden="true">
                      ⌄
                    </span>
                  )}
                </Link>
                {children.length > 0 && (
                  <div className="store-category-popover">
                    <div className="store-category-popover-title">
                      {category.name}
                    </div>
                    <div className="store-category-popover-grid">
                      {children.map((child) => (
                        <Link
                          href={`/categories/${encodeURIComponent(child.slug)}`}
                          key={child.id}
                        >
                          {child.iconId || child.imageId ? (
                            <img
                              src={`/api/catalog/media/${encodeURIComponent((child.iconId ?? child.imageId)!)}`}
                              alt=""
                            />
                          ) : (
                            <span className="store-category-fallback">
                              <DrawerIcon name="category" />
                            </span>
                          )}
                          <span>{child.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        <Link
          href="/about"
          aria-current={pathname === "/about" ? "page" : undefined}
        >
          درباره ما
        </Link>
        <Link
          href="/contact"
          aria-current={pathname === "/contact" ? "page" : undefined}
        >
          تماس با ما
        </Link>
        <Link
          href="/cart"
          aria-current={pathname === "/cart" ? "page" : undefined}
        >
          سبد خرید
          <CartCount count={cartCount} />
        </Link>
      </nav>
      <Box className="store-mobile-nav">
        <IconButton
          sx={{ minWidth: 44, minHeight: 44 }}
          aria-label="باز کردن منوی فروشگاه"
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={!hydrated}
          onClick={() => setOpen(true)}
        >
          <MenuIcon aria-hidden="true" />
        </IconButton>
      </Box>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-label": "منوی فروشگاه",
            sx: { width: "min(300px, 90vw)", p: 2 },
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <strong>منوی فروشگاه</strong>
          <IconButton
            sx={{ minWidth: 44, minHeight: 44 }}
            aria-label="بستن منوی فروشگاه"
            onClick={() => setOpen(false)}
          >
            <CloseIcon aria-hidden="true" />
          </IconButton>
        </Box>
        <nav aria-label="منوی موبایل">
          <DrawerLink
            href="/"
            label="خانه"
            icon="home"
            onNavigate={() => setOpen(false)}
          />
          <DrawerLink
            href="/products"
            label="محصولات"
            icon="products"
            onNavigate={() => setOpen(false)}
          />
          {categories
            .filter((category) => !category.parentId)
            .map((category) => (
              <DrawerLink
                key={category.id}
                href={`/categories/${encodeURIComponent(category.slug)}`}
                label={category.name}
                icon="category"
                iconId={category.iconId ?? category.imageId}
                category
                onNavigate={() => setOpen(false)}
              />
            ))}
          {!categoriesLoaded && (
            <span className="store-drawer-loading">
              در حال دریافت دسته‌بندی‌ها…
            </span>
          )}
          <DrawerLink
            href="/about"
            label="درباره ما"
            icon="about"
            onNavigate={() => setOpen(false)}
          />
          <DrawerLink
            href="/contact"
            label="تماس با ما"
            icon="contact"
            onNavigate={() => setOpen(false)}
          />
          <DrawerLink
            href="/faq"
            label="پرسش‌های متداول"
            icon="faq"
            onNavigate={() => setOpen(false)}
          />
          <DrawerLink
            href="/terms"
            label="قوانین و شرایط"
            icon="terms"
            onNavigate={() => setOpen(false)}
          />
          <DrawerLink
            href="/cart"
            label="سبد خرید"
            icon="cart"
            onNavigate={() => setOpen(false)}
          />
        </nav>
      </Drawer>
      {hydrated &&
        createPortal(
          <nav className="mobile-bottom-nav" aria-label="ناوبری فروشگاه">
            {links.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              if (item.href === "/account")
                return (
                  <button
                    key={item.href}
                    type="button"
                    className={`mobile-bottom-link${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    disabled={accountChecking}
                    onClick={() => void openAccount()}
                  >
                    <span className="mobile-bottom-icon">
                      <NavIcon name={item.icon} />
                    </span>
                    <span className="mobile-account-name">
                      {customerName || item.label}
                    </span>
                  </button>
                );
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mobile-bottom-link${item.featured ? " is-featured" : ""}${active ? " is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="mobile-bottom-icon">
                    <NavIcon name={item.icon} />
                  </span>
                  <span>{item.label}</span>
                  {item.href === "/cart" && <CartCount count={cartCount} />}
                </Link>
              );
            })}
          </nav>,
          document.body,
        )}
      <CustomerAuthDialog
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthenticated={() => router.push("/account")}
      />
      {accountError && (
        <div role="alert" className="account-navigation-error">
          بررسی حساب ممکن نشد؛ دوباره تلاش کنید.
        </div>
      )}
    </>
  );
}

function CartCount({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="cart-count-badge" aria-label={`${count} قلم در سبد خرید`}>
      {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(
        count,
      )}
    </span>
  );
}

function DrawerLink({
  href,
  label,
  icon,
  iconId,
  category = false,
  nested = false,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: string;
  iconId?: string | null;
  category?: boolean;
  nested?: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      className={`store-drawer-link${category ? " store-drawer-category" : ""}${nested ? " is-nested" : ""}`}
      href={href}
      onClick={onNavigate}
    >
      {iconId ? (
        <img
          className="store-drawer-category-icon"
          src={`/api/catalog/media/${encodeURIComponent(iconId)}`}
          alt=""
          aria-hidden="true"
        />
      ) : (
        <DrawerIcon name={icon} />
      )}
      <span>{label}</span>
    </Link>
  );
}
