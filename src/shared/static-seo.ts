import type { ContentSettings } from "./content";
export type StaticPage = keyof ContentSettings["seo"];
export const staticSeoDefaults: Record<
  StaticPage,
  { path: string; label: string; title: string; description: string }
> = {
  home: {
    path: "/",
    label: "خانه",
    title: "فروشگاه | بهارمز",
    description: "فروشگاه آنلاین بهارمز",
  },
  contact: {
    path: "/contact",
    label: "تماس با ما",
    title: "تماس با ما | بهارمز",
    description: "راه‌های ارتباط با بهارمز",
  },
  faq: {
    path: "/faq",
    label: "پرسش‌های متداول",
    title: "پرسش‌های متداول | بهارمز",
    description: "پرسش‌های متداول فروشگاه بهارمز",
  },
  terms: {
    path: "/terms",
    label: "قوانین",
    title: "قوانین و شرایط | بهارمز",
    description: "قوانین و شرایط فروشگاه بهارمز",
  },
  about: {
    path: "/about",
    label: "درباره ما",
    title: "درباره ما | بهارمز",
    description: "درباره فروشگاه بهارمز",
  },
  products: {
    path: "/products",
    label: "محصولات",
    title: "محصولات | بهارمز",
    description: "محصولات فروشگاه بهارمز را ببینید.",
  },
};
export function resolveStaticSeo(
  page: StaticPage,
  value: { title: string; description: string },
) {
  const title = value.title.trim().normalize("NFKC"),
    description = value.description.trim().normalize("NFKC"),
    fallback = staticSeoDefaults[page];
  return {
    title: title || fallback.title,
    description: description || fallback.description,
  };
}
export function staticSeoCompleteness(value: {
  title: string;
  description: string;
}) {
  const title = value.title.trim().normalize("NFKC"),
    description = value.description.trim().normalize("NFKC");
  const titleOk = title.length > 0 && title.length <= 160,
    descriptionOk = description.length > 0 && description.length <= 320;
  return {
    titleOk,
    descriptionOk,
    completed: Number(titleOk) + Number(descriptionOk),
    total: 2,
  };
}
