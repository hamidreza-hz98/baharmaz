/* eslint-disable @next/next/no-img-element -- Private snapshot images use the authenticated media route. */
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney, formatTehranJalali } from "@/shared/locale";
type Order = {
  code: string;
  status: string;
  placedAt: string;
  items: { title: string; imageId: string | null }[];
  payment: { status: string };
  totals: { paidRials: number | null };
};
const tabs = [
  { value: "all", label: "همه سفارش‌ها" },
  { value: "preparing", label: "در حال آماده‌سازی" },
  { value: "delivered", label: "تحویل‌شده" },
  { value: "cancelled", label: "لغوشده" },
];
const statusNames: Record<string, string> = {
  preparing: "در حال آماده‌سازی",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
};
export function OrderHistory() {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Order[]; total: number } | null>(
    null,
  );
  const [error, setError] = useState("");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(
          `/api/account/orders?status=${status}&page=${page}`,
          { cache: "no-store", signal },
        );
        if (!res.ok) throw new Error();
        setData(await res.json());
        setError("");
      } catch {
        if (!signal?.aborted) setError("دریافت سفارش‌ها ممکن نشد.");
      }
    },
    [status, page],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setData(null);
      void load(controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  return (
    <>
      <h1>سفارش‌های من</h1>
      <p>ثبت سفارش جدید هنوز فعال نشده است.</p>
      <div className="order-tabs" role="group" aria-label="وضعیت سفارش">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={status === tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </p>
      )}
      {!data && !error && <p role="status">در حال دریافت سفارش‌ها…</p>}
      {data?.items.length === 0 && <p>سفارشی برای این وضعیت پیدا نشد.</p>}
      {data?.items.map((order) => (
        <article className="order-card" key={order.code}>
          <div className="order-card-top">
            <strong>{statusNames[order.status] || "وضعیت نامشخص"}</strong>
            <span>
              کد سفارش: <bdi dir="ltr">{order.code}</bdi>
            </span>
          </div>
          <p>{formatTehranJalali(order.placedAt)}</p>
          <p>
            {order.payment.status === "verified" &&
            order.totals.paidRials !== null
              ? `مبلغ پرداخت‌شده: ${formatMoney(order.totals.paidRials)}`
              : "پرداخت تأییدشده ثبت نشده است."}
          </p>
          <div className="order-thumbnails">
            {order.items
              .filter((i) => i.imageId)
              .slice(0, 4)
              .map((item, index) => (
                <img
                  key={`${item.imageId}-${index}`}
                  src={`/api/account/orders/${encodeURIComponent(order.code)}/media/${item.imageId}`}
                  alt=""
                />
              ))}
          </div>
          <Link href={`/account/orders/${encodeURIComponent(order.code)}`}>
            جزئیات سفارش <span className="sr-only">{order.code}</span>
          </Link>
        </article>
      ))}
      {data && data.total > 20 && (
        <div className="order-pagination">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            صفحه قبل
          </button>
          <span>صفحه {new Intl.NumberFormat("fa-IR").format(page)}</span>
          <button
            type="button"
            disabled={page * 20 >= data.total}
            onClick={() => setPage(page + 1)}
          >
            صفحه بعد
          </button>
        </div>
      )}
    </>
  );
}
