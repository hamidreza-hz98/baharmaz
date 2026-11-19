"use client";
import { useEffect, useState } from "react";
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
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const activeIndex = banners.length ? index % banners.length : 0;
  const banner = banners[activeIndex];

  useEffect(() => {
    if (banners.length < 2 || paused || interacting) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timer = window.setInterval(() => {
      if (!motion.matches && !document.hidden)
        setIndex((current) => (current + 1) % banners.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [banners.length, paused, interacting]);

  return (
    <section
      className={`home-hero${banner?.imageId ? " has-image" : ""}`}
      aria-label="معرفی بهارمز"
      aria-roledescription="گردونه تصاویر"
      onMouseEnter={() => setInteracting(true)}
      onMouseLeave={() => setInteracting(false)}
      onFocus={() => setInteracting(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setInteracting(false);
      }}
    >
      <div className="home-hero-media">
        {banners.map(
          (item, slideIndex) =>
            item.imageId && (
              <div
                key={item.id}
                className={`home-hero-image${slideIndex === activeIndex ? " is-active" : ""}`}
                aria-hidden={slideIndex !== activeIndex}
              >
                <CatalogImage
                  id={item.imageId}
                  alt={item.alt}
                  priority={slideIndex === 0}
                  fallback={<span />}
                />
              </div>
            ),
        )}
      </div>
      <div className="home-hero-copy">
        <span className="home-hero-eyebrow">
          به دنیای شیرین بهارمز خوش آمدید
        </span>
        <h1>بهارمز</h1>
        <p>{slogan || "فروشگاه آنلاین در حال آماده‌سازی است."}</p>
        {banner?.href && (
          <Link className="home-link-button" href={banner.href}>
            مشاهده بیشتر <span aria-hidden="true">←</span>
          </Link>
        )}
      </div>
      {banners.length > 1 && (
        <div className="hero-controls" aria-label="کنترل تصاویر">
          <div className="hero-dots" role="group" aria-label="انتخاب تصویر">
            {banners.map((item, slideIndex) => (
              <button
                key={item.id}
                type="button"
                className={`hero-dot${slideIndex === activeIndex ? " is-active" : ""}`}
                aria-label={`نمایش تصویر ${new Intl.NumberFormat("fa-IR").format(slideIndex + 1)}`}
                aria-current={slideIndex === activeIndex ? "true" : undefined}
                onClick={() => setIndex(slideIndex)}
              />
            ))}
          </div>
          <div className="hero-controls-actions">
            <button
              type="button"
              className="hero-arrow"
              aria-label="بنر قبلی"
              onClick={() =>
                setIndex((activeIndex + banners.length - 1) % banners.length)
              }
            >
              →
            </button>
            <button
              type="button"
              className="hero-arrow"
              aria-label="بنر بعدی"
              onClick={() => setIndex((activeIndex + 1) % banners.length)}
            >
              ←
            </button>
            <button
              type="button"
              className="hero-pause"
              aria-label={
                paused ? "پخش خودکار تصاویر" : "توقف پخش خودکار تصاویر"
              }
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? "▶" : "Ⅱ"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
