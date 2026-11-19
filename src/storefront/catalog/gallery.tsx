/* eslint-disable @next/next/no-img-element -- Catalog images are already processed WebP. */
"use client";
import { useEffect, useRef, useState } from "react";
import { CatalogImage } from "./catalog-image";

export function Gallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [selected, setSelected] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (fullscreen && !dialog.open) dialog.showModal();
    if (!fullscreen && dialog.open) dialog.close();
  }, [fullscreen]);

  function move(direction: -1 | 1) {
    setSelected(
      (current) => (current + direction + images.length) % images.length,
    );
  }

  return (
    <div>
      <button
        type="button"
        className="catalog-detail-image catalog-gallery-trigger"
        onClick={() => setFullscreen(true)}
        aria-label="برای بزرگنمایی تصویر، روی آن کلیک نمایید"
      >
        <CatalogImage id={images[selected]} alt={title} priority />
      </button>
      <p className="gallery-zoom-hint">
        برای بزرگنمایی تصویر، روی آن کلیک نمایید
      </p>
      {images.length > 1 && (
        <div className="catalog-thumbnails" aria-label="تصاویر محصول">
          {images.map((id, i) => (
            <button
              key={id}
              type="button"
              aria-label={`نمایش تصویر ${i + 1}`}
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
            >
              <img src={`/api/catalog/media/${id}`} alt="" />
            </button>
          ))}
        </div>
      )}
      <dialog
        ref={dialogRef}
        className="catalog-gallery-dialog"
        aria-label={`نمایش بزرگ تصویر ${title}`}
        onCancel={(event) => {
          event.preventDefault();
          setFullscreen(false);
        }}
        onClick={(event) => {
          if (event.target === dialogRef.current) setFullscreen(false);
        }}
      >
        <button
          type="button"
          className="gallery-close"
          aria-label="بستن نمایش تصویر"
          onClick={() => setFullscreen(false)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
        {images.length > 1 && (
          <>
            <button
              type="button"
              className="gallery-arrow gallery-previous"
              aria-label="تصویر قبلی"
              onClick={() => move(-1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
            <button
              type="button"
              className="gallery-arrow gallery-next"
              aria-label="تصویر بعدی"
              onClick={() => move(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          </>
        )}
        <div className="gallery-full-image">
          <CatalogImage id={images[selected]} alt={title} priority />
        </div>
        {images.length > 1 && (
          <span className="gallery-counter" aria-live="polite">
            {new Intl.NumberFormat("fa-IR").format(selected + 1)} /{" "}
            {new Intl.NumberFormat("fa-IR").format(images.length)}
          </span>
        )}
      </dialog>
    </div>
  );
}
