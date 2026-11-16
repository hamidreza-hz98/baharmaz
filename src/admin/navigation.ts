export const adminLinks = [
  { href: "/admin", label: "پیشخوان", group: "مدیریت فروش" },
  { href: "/admin/customers", label: "مشتریان", group: "مدیریت فروش" },
  { href: "/admin/orders", label: "سفارش‌ها", group: "مدیریت فروش" },
  { href: "/admin/products", label: "محصولات", group: "کاتالوگ" },
  { href: "/admin/categories", label: "دسته‌بندی‌ها", group: "کاتالوگ" },
  { href: "/admin/ingredients", label: "مواد اولیه", group: "کاتالوگ" },
  { href: "/admin/media", label: "رسانه‌ها", group: "مدیریت" },
  {
    href: "/admin/contact-submissions",
    label: "پیام‌های تماس",
    group: "مدیریت",
  },
  { href: "/admin/account", label: "حساب مدیر", group: "مدیریت" },
  {
    href: "/admin/settings/homepage",
    label: "صفحه اصلی",
    group: "تنظیمات",
  },
  {
    href: "/admin/settings/contact",
    label: "اطلاعات تماس",
    group: "تنظیمات",
  },
  { href: "/admin/settings/faq", label: "پرسش‌های متداول", group: "تنظیمات" },
  { href: "/admin/settings/terms", label: "قوانین و شرایط", group: "تنظیمات" },
  { href: "/admin/settings/about", label: "درباره ما", group: "تنظیمات" },
  { href: "/admin/settings/seo", label: "سئو", group: "تنظیمات" },
  {
    href: "/admin/operational-settings",
    label: "تنظیمات عملیاتی",
    group: "تنظیمات",
  },
] as const;
