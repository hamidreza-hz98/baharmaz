/* eslint-disable @next/next/no-img-element -- Order snapshot images use the authenticated media route. */
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { formatMoney, formatTehranJalali } from "@/shared/locale";
type Entry = {
  code: string;
  state: string;
  createdAt: string;
  totalRials: number;
  items: {
    title: string;
    image: string | null;
    quantity: number;
    lineRials: number;
  }[];
};
export function SandboxOrderHistory() {
  const [items, setItems] = useState<Entry[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/checkout/sandbox-orders", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.items)
          setItems(
            data.items.filter((item: Entry) => item.state !== "verified"),
          );
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (!items.length) return null;
  return (
    <section
      className="sandbox-order-list"
      aria-labelledby="sandbox-orders-title"
    >
      <h2 id="sandbox-orders-title">سفارش‌های آزمایشی</h2>
      <p className="sandbox-order-note">
        این سفارش‌ها فقط برای آزمایش هستند و برای ارسال ثبت نمی‌شوند.
      </p>
      {items.map((item) => (
        <article key={item.code} className="order-card sandbox-order-card">
          <strong
            className={`order-status ${item.state === "verified" ? "is-success" : item.state === "failed" ? "is-failure" : "is-pending"}`}
          >
            <span aria-hidden="true">
              {item.state === "verified"
                ? "✓"
                : item.state === "failed"
                  ? "×"
                  : "…"}
            </span>
            {item.state === "verified"
              ? "پرداخت آزمایشی موفق"
              : item.state === "failed"
                ? "پرداخت آزمایشی ناموفق"
                : "در انتظار بررسی"}
          </strong>
          <div className="account-order-products">
            {(item.items ?? []).map((product, index) => (
              <div
                className="account-order-product"
                key={`${product.title}-${index}`}
              >
                {product.image ? (
                  <img
                    src={`/api/checkout/sandbox-orders/${encodeURIComponent(item.code)}/media/${encodeURIComponent(product.image)}`}
                    alt=""
                  />
                ) : (
                  <span
                    className="account-order-image-placeholder"
                    aria-hidden="true"
                  >
                    □
                  </span>
                )}
                <div>
                  <strong>{product.title}</strong>
                  <span>
                    تعداد:{" "}
                    {new Intl.NumberFormat("fa-IR").format(product.quantity)}
                  </span>
                </div>
                <strong className="account-order-product-price">
                  {formatMoney(product.lineRials)}
                </strong>
              </div>
            ))}
          </div>
          <div className="order-card-details">
            <div>
              <span>کد سفارش</span>
              <bdi dir="ltr">{item.code}</bdi>
            </div>
            <div>
              <span>تاریخ ثبت</span>
              <strong>{formatTehranJalali(item.createdAt)}</strong>
            </div>
            <div>
              <span>مبلغ آزمایشی</span>
              <strong>{formatMoney(item.totalRials)}</strong>
            </div>
          </div>
          <Link
            className="order-card-action"
            href={`/checkout/payment/${encodeURIComponent(item.code)}`}
          >
            مشاهده نتیجه <ArrowBackIcon aria-hidden="true" />{" "}
            <span className="sr-only">{item.code}</span>
          </Link>
        </article>
      ))}
    </section>
  );
}
