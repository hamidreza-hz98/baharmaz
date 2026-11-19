/* eslint-disable @next/next/no-img-element -- Private snapshot images use the authenticated media route. */
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { formatMoney, formatTehranJalali } from "@/shared/locale";
import { SandboxOrderHistory } from "./sandbox-order-history";
type Order = {
  code: string;
  isTest: boolean;
  status: string;
  placedAt: string;
  items: {
    title: string;
    imageId: string | null;
    quantity: number;
    lineRials: number;
  }[];
  payment: { status: string };
  totals: { paidRials: number | null; totalRials: number | null };
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
      <SandboxOrderHistory />
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
      {data?.items.length === 0 && (
        <p>سفارش غیرآزمایشی برای این وضعیت پیدا نشد.</p>
      )}
      {data?.items.map((order) => (
        <article className="order-card" key={order.code}>
          {order.isTest && (
            <span className="sandbox-result-badge">سفارش آزمایشی</span>
          )}
          <div className="order-card-top">
            <strong>{statusNames[order.status] || "وضعیت نامشخص"}</strong>
            <span>
              کد سفارش: <bdi dir="ltr">{order.code}</bdi>
            </span>
          </div>
          <p>{formatTehranJalali(order.placedAt)}</p>
          <p>
            {order.isTest && order.totals.totalRials !== null
              ? `مبلغ آزمایشی: ${formatMoney(order.totals.totalRials)}`
              : order.payment.status === "verified" &&
                  order.totals.paidRials !== null
                ? `مبلغ پرداخت‌شده: ${formatMoney(order.totals.paidRials)}`
                : "پرداخت تأییدشده ثبت نشده است."}
          </p>
          <div className="account-order-products">
            {order.items.map((item, index) => (
              <div
                className="account-order-product"
                key={`${item.imageId}-${index}`}
              >
                {item.imageId ? (
                  <img
                    src={`/api/account/orders/${encodeURIComponent(order.code)}/media/${item.imageId}`}
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
                  <strong>{item.title}</strong>
                  <span>
                    تعداد:{" "}
                    {new Intl.NumberFormat("fa-IR").format(item.quantity)}
                  </span>
                </div>
                <strong className="account-order-product-price">
                  {formatMoney(item.lineRials)}
                </strong>
              </div>
            ))}
          </div>
          <Link
            className="order-card-action"
            href={`/account/orders/${encodeURIComponent(order.code)}`}
          >
            جزئیات سفارش <ArrowBackIcon aria-hidden="true" />{" "}
            <span className="sr-only">{order.code}</span>
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
