"use client";
import { useState } from "react";
import Link from "next/link";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import PermMediaOutlinedIcon from "@mui/icons-material/PermMediaOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import SpaOutlinedIcon from "@mui/icons-material/SpaOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ContactMailOutlinedIcon from "@mui/icons-material/ContactMailOutlined";
import QuizOutlinedIcon from "@mui/icons-material/QuizOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { useRouter } from "next/navigation";

const icons: Record<string, typeof DashboardOutlinedIcon> = {
  "/admin": DashboardOutlinedIcon,
  "/admin/orders": ReceiptLongOutlinedIcon,
  "/admin/customers": PeopleOutlineIcon,
  "/admin/contact-submissions": ForumOutlinedIcon,
  "/admin/settings/homepage": HomeOutlinedIcon,
  "/admin/settings/contact": ContactMailOutlinedIcon,
  "/admin/settings/faq": QuizOutlinedIcon,
  "/admin/settings/terms": GavelOutlinedIcon,
  "/admin/settings/about": InfoOutlinedIcon,
  "/admin/settings/seo": TravelExploreOutlinedIcon,
  "/admin/operational-settings": SettingsOutlinedIcon,
  "/admin/account": AccountCircleOutlinedIcon,
  "/admin/media": PermMediaOutlinedIcon,
  "/admin/products": Inventory2OutlinedIcon,
  "/admin/categories": CategoryOutlinedIcon,
  "/admin/ingredients": SpaOutlinedIcon,
};
type AdminLink = { href: `/admin${string}`; label: string; group?: string };
/** Presentation only. Mount exclusively beneath a server-side admin authorization guard. */
export function AdminShell({
  children,
  links,
  currentPath,
}: {
  children: React.ReactNode;
  links: readonly AdminLink[];
  currentPath: string;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [profileAnchor, setProfileAnchor] = useState<HTMLElement | null>(null);
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  async function logout() {
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error();
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setLogoutError("خروج ممکن نشد. دوباره تلاش کنید.");
    } finally {
      setLoggingOut(false);
    }
  }
  const navigation = (close?: () => void) => (
    <nav aria-label="ناوبری مدیریت" className="admin-nav">
      {links.map((link, index) => {
        const Icon = icons[link.href] || DashboardOutlinedIcon;
        const startsGroup = Boolean(
          link.group && link.group !== links[index - 1]?.group,
        );
        const selected =
          currentPath === link.href ||
          (link.href !== "/admin" &&
            currentPath.startsWith(`${link.href}/`));
        return (
          <div
            key={link.href}
            className={startsGroup ? "admin-nav-group-start" : undefined}
          >
            {startsGroup && (
              <div className="admin-nav-group-label">{link.group}</div>
            )}
            <Link
              href={link.href}
              aria-current={selected ? "page" : undefined}
              title={link.label}
              onClick={close}
            >
              <Icon fontSize="small" aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
  return (
    <div className={`admin-shell${collapsed ? " admin-shell-collapsed" : ""}`}>
      <a className="skip-link" href="#admin-content">
        رفتن به محتوای اصلی
      </a>
      <aside className="admin-sidebar">
        <div className="admin-sidebar-heading">
          <strong>{collapsed ? "ب" : "مدیریت بهارمز"}</strong>
          <IconButton
            size="small"
            aria-expanded={!collapsed}
            aria-label={
              collapsed ? "گسترش منوی مدیریت" : "جمع کردن منوی مدیریت"
            }
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronLeftIcon /> : <ChevronRightIcon />}
          </IconButton>
        </div>
        {navigation()}
      </aside>
      <div className="admin-body">
        <header className="admin-header">
          <Box className="admin-menu-trigger">
            <IconButton
              sx={{ minWidth: 44, minHeight: 44 }}
              aria-label="باز کردن منوی مدیریت"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
            >
              <MenuIcon aria-hidden="true" />
            </IconButton>
          </Box>
          <strong>مدیریت بهارمز</strong>
          <Box className="admin-profile-menu">
            <Button
              id="admin-profile-trigger"
              aria-label="منوی حساب مدیر"
              className="admin-profile-trigger"
              aria-haspopup="menu"
              aria-expanded={Boolean(profileAnchor)}
              aria-controls={
                profileAnchor ? "admin-profile-options" : undefined
              }
              onClick={(event) => setProfileAnchor(event.currentTarget)}
              disableElevation
            >
              <Avatar className="admin-profile-avatar">
                <AccountCircleOutlinedIcon fontSize="small" />
              </Avatar>
              <Box className="admin-profile-label">
                <strong>حساب مدیر</strong>
                <span>مدیریت حساب</span>
              </Box>
              <ExpandMoreRoundedIcon
                className={
                  profileAnchor
                    ? "admin-profile-chevron is-open"
                    : "admin-profile-chevron"
                }
                fontSize="small"
              />
            </Button>
            <Menu
              id="admin-profile-options"
              anchorEl={profileAnchor}
              open={Boolean(profileAnchor)}
              onClose={() => setProfileAnchor(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              transformOrigin={{ vertical: "top", horizontal: "left" }}
              slotProps={{
                list: {
                  "aria-labelledby": "admin-profile-trigger",
                  dense: true,
                },
                paper: { className: "admin-profile-popover" },
              }}
            >
              <Box className="admin-profile-popover-heading">
                <Avatar className="admin-profile-avatar">
                  <AccountCircleOutlinedIcon fontSize="small" />
                </Avatar>
                <Box>
                  <Typography variant="subtitle2">حساب مدیر</Typography>
                  <Typography variant="caption" color="text.secondary">
                    مدیریت اطلاعات و نشست‌ها
                  </Typography>
                </Box>
              </Box>
              <Divider />
              <MenuItem
                component={Link}
                href="/admin/account"
                onClick={() => setProfileAnchor(null)}
              >
                <ListItemIcon>
                  <AccountCircleOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>اطلاعات حساب و نشست‌ها</ListItemText>
              </MenuItem>
              <MenuItem
                onClick={logout}
                disabled={loggingOut}
                className="admin-profile-logout"
              >
                <ListItemIcon>
                  <LogoutOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {loggingOut ? "در حال خروج…" : "خروج از حساب"}
                </ListItemText>
              </MenuItem>
              {logoutError && (
                <Box sx={{ px: 1.5, pb: 1 }}>
                  <Alert severity="error" role="alert">
                    {logoutError}
                  </Alert>
                </Box>
              )}
            </Menu>
          </Box>
        </header>
        <main id="admin-content" tabIndex={-1} className="admin-content">
          {children}
        </main>
      </div>
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        slotProps={{
          paper: {
            role: "dialog",
            "aria-label": "منوی مدیریت",
            sx: { width: "min(300px, 90vw)", p: 2 },
          },
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <strong>مدیریت بهارمز</strong>
          <IconButton
            sx={{ minWidth: 44, minHeight: 44 }}
            aria-label="بستن منوی مدیریت"
            onClick={() => setOpen(false)}
          >
            <CloseIcon aria-hidden="true" />
          </IconButton>
        </Box>
        {navigation(() => setOpen(false))}
      </Drawer>
    </div>
  );
}
