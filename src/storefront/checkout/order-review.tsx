"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/shared/locale";
type Review = {
  customer: { name: string; mobile: string };
  address: {
    label: string;
    recipient: string;
    mobile: string;
    address: string;
    postalCode: string;
  };
  items: {
    id: string;
    title: string;
    quantity: number;
    saleRials: number;
    lineRials: number;
  }[];
  delivery: {
    date: string;
    slot: { label: string; start: string; end: string };
    shippingRials: number;
    itemsTotalRials: number;
    totalRials: number;
  };
};
export function OrderReview() {
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  async function load() {
    try {
      const token = sessionStorage.getItem("lamsechi-delivery-quote");
      if (!token) throw new Error("ابتدا زمان ارسال و هزینه را انتخاب کنید.");
      const response = await fetch("/api/order-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setReview(result.review);
      setError("");
    } catch (e) {
      setReview(null);
      setError(e instanceof Error ? e.message : "دریافت پیش‌فاکتور ممکن نشد.");
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, []);
  return (
    <>
      <h1>بررسی سفارش</h1>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </p>
      )}
      {!review && !error && <p role="status">در حال بررسی اطلاعات…</p>}
      {review && (
        <>
          <section>
            <h2>اطلاعات گیرنده</h2>
            <p>
              {review.customer.name} ·{" "}
              <bdi dir="ltr">{review.customer.mobile}</bdi>
            </p>
            <p>
              {review.address.recipient} ·{" "}
              <bdi dir="ltr">{review.address.mobile}</bdi>
            </p>
            <p>{review.address.address}</p>
            <Link href="/checkout/address">ویرایش نشانی و زمان</Link>
          </section>
          <section>
            <h2>محصولات</h2>
            {review.items.map((item) => (
              <p key={item.id}>
                {item.title} ×{" "}
                {new Intl.NumberFormat("fa-IR").format(item.quantity)}:{" "}
                {formatMoney(item.lineRials)}
              </p>
            ))}
            <Link href="/cart">ویرایش سبد خرید</Link>
          </section>
          <section>
            <h2>ارسال و مبلغ</h2>
            <p>
              <bdi dir="ltr">{review.delivery.date}</bdi> ·{" "}
              {review.delivery.slot.label}{" "}
              <bdi dir="ltr">
                {review.delivery.slot.start}–{review.delivery.slot.end}
              </bdi>
            </p>
            <p>جمع کالاها: {formatMoney(review.delivery.itemsTotalRials)}</p>
            <p>هزینه ارسال: {formatMoney(review.delivery.shippingRials)}</p>
            <p>مبلغ نهایی: {formatMoney(review.delivery.totalRials)}</p>
            <p>ثبت سفارش هنوز فعال نیست.</p>
          </section>
        </>
      )}
      <p>
        <Link href="/checkout/address">بازگشت به انتخاب ارسال</Link>
      </p>
    </>
  );
}
