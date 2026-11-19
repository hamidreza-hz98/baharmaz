"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/shared/locale";

type SandboxOrder = {
  code: string;
  state: string;
  redirectUrl?: string;
  snapshot: {
    delivery: { totalRials: number };
    items: { title: string; quantity: number; lineRials: number }[];
  };
};
export function SandboxPaymentResult({ code }: { code: string }) {
  const [order, setOrder] = useState<SandboxOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/checkout/sandbox-orders/${encodeURIComponent(code)}`,
          { cache: "no-store", signal },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "دریافت نتیجه ممکن نشد.");
        let latest = data.order;
        if (latest.state === "unknown" || latest.state === "verifying") {
          const checked = await fetch(
            `/api/checkout/sandbox-orders/${encodeURIComponent(code)}`,
            { method: "POST", signal, cache: "no-store" },
          );
          if (checked.ok) latest = (await checked.json()).order;
        }
        setOrder(latest);
        setError("");
      } catch (e) {
        if (!signal?.aborted)
          setError(e instanceof Error ? e.message : "دریافت نتیجه ممکن نشد.");
      } finally {
        if (!signal?.aborted) setLoading(false);
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
  const state = order?.state;
  const title =
    state === "verified"
      ? "پرداخت آزمایشی موفق بود"
      : state === "failed"
        ? "پرداخت آزمایشی ناموفق بود"
        : "وضعیت پرداخت آزمایشی در حال بررسی است";
  return (
    <section
      className="payment-outcome sandbox-result"
      aria-labelledby="sandbox-result-title"
    >
      {loading && !order && <p role="status">در حال دریافت نتیجه پرداخت…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </div>
      )}
      {order && (
        <>
          <div
            className={`sandbox-result-icon ${state === "verified" ? "is-success" : state === "failed" ? "is-failure" : ""}`}
            aria-hidden="true"
          >
            {state === "verified" ? "✓" : state === "failed" ? "×" : "…"}
          </div>
          <span className="sandbox-result-badge">سفارش آزمایشی</span>
          <h1 id="sandbox-result-title">{title}</h1>
          <p role="status">
            {state === "verified"
              ? "درگاه آزمایشی پرداخت را تأیید کرد. هیچ مبلغ واقعی پرداخت نشده و سفارشی برای ارسال ثبت نشده است."
              : state === "failed"
                ? "پرداخت در محیط آزمایشی ناموفق بود. برای تلاش دوباره، نشانی و زمان تحویل را انتخاب کنید."
                : "نتیجه قطعی هنوز تأیید نشده است. برای جلوگیری از پرداخت تکراری، ابتدا وضعیت را بررسی کنید."}
          </p>
          <div className="sandbox-result-summary">
            <div className="sandbox-result-code">
              <span>کد سفارش آزمایشی</span>
              <strong dir="ltr">{order.code}</strong>
            </div>
            <div>
              <span>مبلغ آزمایشی</span>
              <strong>{formatMoney(order.snapshot.delivery.totalRials)}</strong>
            </div>
          </div>
          <div className="payment-outcome-actions">
            <Link href="/account">سفارش‌های من</Link>
            <Link href="/">بازگشت به خانه</Link>
            {state === "pending" &&
              order.redirectUrl &&
              /^https:\/\/panel\.aqayepardakht\.ir\/startpay\/sandbox\/[A-Za-z0-9_-]{1,128}$/.test(
                order.redirectUrl,
              ) && <a href={order.redirectUrl}>ادامه پرداخت آزمایشی</a>}
            {state === "failed" && (
              <Link href="/checkout/address">تلاش دوباره</Link>
            )}
            {state !== "failed" && state !== "verified" && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void load()}
              >
                {loading ? "در حال بررسی…" : "بررسی وضعیت"}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
