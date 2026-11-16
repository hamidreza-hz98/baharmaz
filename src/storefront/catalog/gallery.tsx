/* eslint-disable @next/next/no-img-element -- Catalog images are already processed WebP. */
"use client";
import { useState } from "react";
import { CatalogImage } from "./catalog-image";
export function Gallery({
  images,
  title,
}: {
  images: string[];
  title: string;
}) {
  const [selected, setSelected] = useState(0);
  return (
    <div>
      <div className="catalog-detail-image">
        <CatalogImage id={images[selected]} alt={title} priority />
      </div>
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
    </div>
  );
}
