"use client";
import { useState } from "react";
import Link from "next/link";
import { CatalogImage } from "@/storefront/catalog/catalog-image";
import type { ContentSettings } from "@/shared/content";
export function Hero({
  banners,
  slogan,
}: {
  banners: ContentSettings["homepage"]["banners"];
  slogan: string;
}) {
  const [index, setIndex] = useState(0);
  const banner = banners[index];
  return (
    <section className="home-hero" aria-label="معرفی بهارمز">
      <div className="home-hero-copy">
        <h1>بهارمز</h1>
        <p>{slogan || "فروشگاه آنلاین در حال آماده‌سازی است."}</p>
        {banner?.href && (
          <Link className="home-link-button" href={banner.href}>
            مشاهده بیشتر
          </Link>
        )}
        {banners.length > 1 && (
          <div className="hero-controls">
            <button
              type="button"
              aria-label="بنر قبلی"
              onClick={() =>
                setIndex((index + banners.length - 1) % banners.length)
              }
            >
              →
            </button>
            <span aria-live="polite">
              {new Intl.NumberFormat("fa-IR").format(index + 1)} از{" "}
              {new Intl.NumberFormat("fa-IR").format(banners.length)}
            </span>
            <button
              type="button"
              aria-label="بنر بعدی"
              onClick={() => setIndex((index + 1) % banners.length)}
            >
              ←
            </button>
          </div>
        )}
      </div>
      {banner?.imageId && (
        <div className="home-hero-image">
          <CatalogImage id={banner.imageId} alt={banner.alt} priority />
        </div>
      )}
    </section>
  );
}
