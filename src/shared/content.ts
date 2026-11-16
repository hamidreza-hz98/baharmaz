export const staticPages = [
  "home",
  "contact",
  "faq",
  "terms",
  "about",
  "products",
] as const;
export const contentSections = [
  "homepage",
  "contact",
  "faq",
  "terms",
  "about",
] as const;
export type ContentSection = (typeof contentSections)[number];
export type Entry = { id: string; title: string; body: string };
export type SiteContentSettings = {
  homepage: {
    banners: {
      id: string;
      imageId: string | null;
      href: string;
      alt: string;
    }[];
    slogans: { id: string; text: string }[];
    aboutTitle: string;
    aboutText: string;
    aboutImageId: string | null;
  };
  contact: {
    phones: { id: string; value: string }[];
    socials: { id: string; label: string; url: string }[];
    address: string;
    mapUrl: string;
  };
  faq: { title: string; description: string; items: Entry[] };
  terms: { title: string; description: string; items: Entry[] };
  about: { title: string; body: string; imageId: string | null };
};
export type StaticSeoSettings = Record<
  (typeof staticPages)[number],
  { title: string; description: string }
>;
export type ContentSettings = SiteContentSettings & { seo: StaticSeoSettings };
