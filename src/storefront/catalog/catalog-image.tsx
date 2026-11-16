/* eslint-disable @next/next/no-img-element -- Catalog images are processed WebP. */
"use client";
import { useState } from "react";
export function CatalogImage({
  id,
  alt = "",
  priority = false,
}: {
  id?: string | null;
  alt?: string;
  priority?: boolean;
}) {
  const [failedId, setFailedId] = useState<string | null>(null);
  return !id || failedId === id ? (
    <span>تصویری موجود نیست</span>
  ) : (
    <img
      src={`/api/catalog/media/${id}`}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailedId(id)}
    />
  );
}
