"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { MenuItem, Select } from "@mui/material";
import type { PublicCard } from "@/shared/public-catalog";
import { ProductCard } from "./product-card";

type Category = {
  id: string;
  name: string;
  slug: string;
  parentId?: string | null;
};
type Result = { items: PublicCard[]; total: number; nextCursor: string | null };
const filterMenuProps = {
  slotProps: {
    paper: {
      className: "delivery-date-menu",
      sx: {
        maxHeight: 320,
        mt: 0.75,
        borderRadius: 2.5,
        border: "1px solid #eadfd8",
        boxShadow: "0 12px 32px rgb(62 35 29 / 16%)",
      },
    },
  },
};
export function CatalogList({
  categories,
  initialCategory = "",
}: {
  categories: Category[];
  initialCategory?: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [sort, setSort] = useState("newest");
  const [items, setItems] = useState<PublicCard[]>([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [started, setStarted] = useState(false);
  const generation = useRef(0);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const automatic = useRef(0);
  const load = useCallback(
    async (next: string | null, replace: boolean, epoch: number) => {
      if (busy.current && !replace) return;
      busy.current = true;
      setLoading(true);
      setError(false);
      try {
        const p = new URLSearchParams({ sort });
        if (category) p.set("category", category);
        if (next) p.set("cursor", next);
        const response = await fetch(`/api/catalog?${p}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error();
        const data: Result = await response.json();
        if (epoch !== generation.current) return;
        setItems((old) => {
          const combined = replace ? [] : [...old];
          const seen = new Set(combined.map((x) => x.id));
          for (const item of data.items)
            if (!seen.has(item.id)) {
              seen.add(item.id);
              combined.push(item);
            }
          return combined;
        });
        setCursor(data.nextCursor);
        setTotal(data.total);
        setStarted(true);
      } catch {
        if (epoch === generation.current) {
          setError(true);
          setStarted(true);
        }
      } finally {
        if (epoch === generation.current) {
          busy.current = false;
          setLoading(false);
        }
      }
    },
    [category, sort],
  );
  useEffect(() => {
    const epoch = ++generation.current;
    busy.current = false;
    automatic.current = 0;
    const timer = setTimeout(() => {
      setStarted(false);
      setItems([]);
      setCursor(null);
      void load(null, true, epoch);
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (
      !cursor ||
      loading ||
      error ||
      automatic.current >= 2 ||
      !sentinel.current
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && automatic.current < 2) {
          automatic.current++;
          void load(cursor, false, generation.current);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cursor, loading, error, load]);
  return (
    <>
      <div className="catalog-controls">
        <div className="catalog-control">
          <span id="catalog-category-label">دسته‌بندی</span>
          <Select
            labelId="catalog-category-label"
            className="catalog-filter-select"
            size="small"
            displayEmpty
            MenuProps={filterMenuProps}
            value={category}
            onChange={(e) => {
              const value = e.target.value;
              if (initialCategory) {
                const selected = categories.find((item) => item.id === value);
                window.location.assign(
                  selected
                    ? `/categories/${encodeURIComponent(selected.slug)}`
                    : "/products",
                );
              } else setCategory(value);
            }}
          >
            <MenuItem value="">همه دسته‌بندی‌ها</MenuItem>
            {categories
              .filter((c) => !c.parentId)
              .flatMap((parent) => [
                parent,
                ...categories.filter((c) => c.parentId === parent.id),
              ])
              .map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.parentId ? `↳ ${c.name}` : c.name}
                </MenuItem>
              ))}
          </Select>
        </div>
        <div className="catalog-control">
          <span id="catalog-sort-label">مرتب‌سازی</span>
          <Select
            labelId="catalog-sort-label"
            className="catalog-filter-select"
            size="small"
            MenuProps={filterMenuProps}
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <MenuItem value="newest">جدیدترین</MenuItem>
            <MenuItem value="cheapest">کمترین قیمت</MenuItem>
            <MenuItem value="expensive">بیشترین قیمت</MenuItem>
          </Select>
        </div>
      </div>
      <p aria-live="polite">
        {started && !error
          ? `${new Intl.NumberFormat("fa-IR").format(total)} محصول`
          : loading
            ? "در حال دریافت محصولات…"
            : ""}
      </p>
      {started && !loading && !error && items.length === 0 && (
        <p className="catalog-empty">محصولی برای این انتخاب پیدا نشد.</p>
      )}
      <div className="catalog-grid">
        {items.map((item) => (
          <ProductCard key={item.id} item={item} />
        ))}
      </div>
      <div ref={sentinel} aria-hidden="true" />
      <div className="catalog-more" aria-live="polite">
        {loading && <p>در حال دریافت محصولات…</p>}
        {error && <p>دریافت محصولات ممکن نشد.</p>}
        {error && (
          <button
            className="catalog-button"
            onClick={() =>
              void load(cursor, items.length === 0, generation.current)
            }
          >
            تلاش دوباره
          </button>
        )}
        {!error && !loading && cursor && (
          <button
            className="catalog-button"
            onClick={() => void load(cursor, false, generation.current)}
          >
            نمایش محصولات بیشتر
          </button>
        )}
        {started && !cursor && items.length > 0 && (
          <p>همه محصولات نمایش داده شدند.</p>
        )}
      </div>
    </>
  );
}
