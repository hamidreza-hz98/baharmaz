"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { Box, Drawer, IconButton } from "@mui/material";

const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverPending = () => false;

export function StoreNavigation() {
  const [open, setOpen] = useState(false);
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientReady,
    serverPending,
  );
  const pathname = usePathname();
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
          محصولات
        </Link>
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
          <Link
            className="store-drawer-link"
            href="/"
            onClick={() => setOpen(false)}
          >
            خانه
          </Link>
          <Link
            className="store-drawer-link"
            href="/products"
            onClick={() => setOpen(false)}
          >
            محصولات
          </Link>
          <Link
            className="store-drawer-link"
            href="/about"
            onClick={() => setOpen(false)}
          >
            درباره ما
          </Link>
          <Link
            className="store-drawer-link"
            href="/contact"
            onClick={() => setOpen(false)}
          >
            تماس با ما
          </Link>
          <Link
            className="store-drawer-link"
            href="/faq"
            onClick={() => setOpen(false)}
          >
            پرسش‌های متداول
          </Link>
          <Link
            className="store-drawer-link"
            href="/terms"
            onClick={() => setOpen(false)}
          >
            قوانین و شرایط
          </Link>
          <Link
            className="store-drawer-link"
            href="/cart"
            onClick={() => setOpen(false)}
          >
            سبد خرید
          </Link>
        </nav>
      </Drawer>
    </>
  );
}
