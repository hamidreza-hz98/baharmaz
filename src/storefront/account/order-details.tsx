/* eslint-disable @next/next/no-img-element -- Private snapshot images use the authenticated media route. */
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney, formatTehranJalali } from "@/shared/locale";
type Order = {
  code: string;
  status: string;
  placedAt: string;
  items: {
    title: string;
    quantity: number;
    unitRials: number;
    lineRials: number;
    imageId: string | null;
  }[];
  address: {
    recipient: string;
    mobile: string;
    address: string;
    postalCode: string;
  };
  delivery: { date: string; slotLabel: string };
  payment: { status: string; transactionReference: string };
  totals: {
    subtotalRials: number | null;
    discountRials: number | null;
    shippingRials: number | null;
    totalRials: number | null;
    paidRials: number | null;
  };
};
const statusNames: Record<string, string> = {
  preparing: "در حال آماده‌سازی",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
};
const amount = (x: number | null) => (x === null ? "ثبت نشده" : formatMoney(x));
export function OrderDetails({ code }: { code: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const res = await fetch(
          `/api/account/orders?code=${encodeURIComponent(code)}`,
          { cache: "no-store", signal },
        );
        if (!res.ok) {
          if (res.status === 404) throw new Error("سفارش پیدا نشد.");
          throw new Error("دریافت سفارش ممکن نشد.");
        }
        setOrder((await res.json()).order);
        setError("");
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : "دریافت سفارش ممکن نشد.");
      }
    },
    [code],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  return (
    <>
      <h1>جزئیات سفارش</h1>
      <Link href="/account">بازگشت به سفارش‌ها</Link>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </p>
      )}
      {!order && !error && <p role="status">در حال دریافت سفارش…</p>}
      {order && (
        <>
          <section className="order-card">
            <h2>{statusNames[order.status] || "وضعیت نامشخص"}</h2>
            <p>
              کد سفارش: <bdi dir="ltr">{order.code}</bdi>
            </p>
            <p>{formatTehranJalali(order.placedAt)}</p>
            <p>
              پرداخت:{" "}
              {order.payment.status === "verified"
                ? "تأیید شده"
                : order.payment.status === "failed"
                  ? "ناموفق"
                  : "در انتظار تأیید"}
            </p>
            {order.payment.transactionReference && (
              <p>
                شماره تراکنش:{" "}
                <bdi dir="ltr">{order.payment.transactionReference}</bdi>
              </p>
            )}
          </section>
          <section className="order-card">
            <h2>گیرنده و ارسال</h2>
            <p>
              {order.address.recipient} ·{" "}
              <bdi dir="ltr">{order.address.mobile}</bdi>
            </p>
            <p>{order.address.address}</p>
            {order.address.postalCode && (
              <p>
                کد پستی: <bdi dir="ltr">{order.address.postalCode}</bdi>
              </p>
            )}
            <p>
              تاریخ تحویل: <bdi dir="ltr">{order.delivery.date}</bdi> ·{" "}
              {order.delivery.slotLabel}
            </p>
          </section>
          <section className="order-card">
            <h2>محصولات</h2>
            {order.items.map((item, index) => (
              <div className="order-detail-item" key={index}>
                {item.imageId && (
                  <img
                    src={`/api/account/orders/${encodeURIComponent(order.code)}/media/${item.imageId}`}
                    alt=""
                  />
                )}
                <span>
                  {item.title} ×{" "}
                  {new Intl.NumberFormat("fa-IR").format(item.quantity)} —{" "}
                  {formatMoney(item.lineRials)}
                </span>
              </div>
            ))}
            <p>جمع کالاها: {amount(order.totals.subtotalRials)}</p>
            <p>تخفیف: {amount(order.totals.discountRials)}</p>
            <p>هزینه ارسال: {amount(order.totals.shippingRials)}</p>
            <p>مبلغ نهایی: {amount(order.totals.totalRials)}</p>
            <p>مبلغ پرداخت‌شده: {amount(order.totals.paidRials)}</p>
          </section>
        </>
      )}
    </>
  );
}
