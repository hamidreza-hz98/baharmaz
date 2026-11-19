"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/shared/locale";
import { PriceBreakdown } from "@/storefront/cart/price-breakdown";
import { CatalogImage } from "@/storefront/catalog/catalog-image";
const faNumber = new Intl.NumberFormat("fa-IR", { useGrouping: false });
const localDigits = (value: string) =>
  value.replace(/\d/g, (digit) => faNumber.format(Number(digit)));
function ReviewIcon({
  type,
}: {
  type: "address" | "items" | "delivery" | "edit" | "person" | "phone";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "address" ? (
        <>
          <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="2.5" />
        </>
      ) : type === "items" ? (
        <>
          <path d="m3 7 9-4 9 4-9 5-9-5Zm0 0v10l9 4 9-4V7m-9 5v9" />
        </>
      ) : type === "delivery" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      ) : type === "edit" ? (
        <>
          <path d="m14 5 5 5M4 20l4-.8L20 7a2.8 2.8 0 0 0-4-4L4.8 15.2 4 20Z" />
        </>
      ) : type === "person" ? (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M5 21a7 7 0 0 1 14 0" />
        </>
      ) : (
        <path d="M6.6 3.5 9 3l2 4-1.8 1.8a15 15 0 0 0 6 6L17 13l4 2-.5 2.4a3 3 0 0 1-3.3 2.4A16.5 16.5 0 0 1 4.2 6.8 3 3 0 0 1 6.6 3.5Z" />
      )}
    </svg>
  );
}
type Review = {
  subtotalRials: number;
  discountRials: number;
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
    image: string | null;
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
  const router = useRouter();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submitLock = useRef(false);
  async function submitOrder() {
    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const token = sessionStorage.getItem("lamsechi-delivery-quote");
      if (!token) throw new Error("ابتدا نشانی و زمان ارسال را انتخاب کنید.");
      const response = await fetch("/api/checkout/sandbox-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "ثبت سفارش آزمایشی ممکن نشد.");
      if (
        typeof data.code !== "string" ||
        !/^TEST-[A-F0-9]{16}$/.test(data.code)
      )
        throw new Error("پاسخ پرداخت معتبر نیست.");
      if (data.redirectUrl) {
        const url = new URL(data.redirectUrl);
        if (
          url.origin !== "https://panel.aqayepardakht.ir" ||
          !/^\/startpay\/sandbox\/[A-Za-z0-9_-]{1,128}$/.test(url.pathname) ||
          url.search ||
          url.hash
        )
          throw new Error("نشانی درگاه آزمایشی معتبر نیست.");
        window.location.assign(url.href);
      } else router.push(`/checkout/payment/${encodeURIComponent(data.code)}`);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : "ارتباط برقرار نشد؛ دوباره تلاش کنید.",
      );
      submitLock.current = false;
      setSubmitting(false);
    }
  }
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
      <header className="review-page-heading">
        <h1>بررسی سفارش</h1>
        <p>جزئیات سفارش و اطلاعات تحویل را بررسی کنید.</p>
      </header>
      {error && (
        <div className="review-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>
            تلاش دوباره
          </button>
          <Link href="/checkout/address">بازگشت به انتخاب ارسال</Link>
        </div>
      )}
      {!review && !error && <p role="status">در حال بررسی اطلاعات…</p>}
      {review && (
        <div className="review-layout">
          <div className="review-details">
            <section
              className="review-card"
              aria-labelledby="review-items-heading"
            >
              <div className="review-card-header">
                <div className="review-heading">
                  <span className="review-icon">
                    <ReviewIcon type="items" />
                  </span>
                  <h2 id="review-items-heading">محصولات سفارش</h2>
                </div>
                <Link
                  className="review-edit"
                  href="/cart"
                  aria-label="ویرایش محصولات سبد خرید"
                >
                  <ReviewIcon type="edit" />
                  ویرایش
                </Link>
              </div>
              <ul className="review-items">
                {review.items.map((item) => (
                  <li key={item.id}>
                    <div className="review-item-image" aria-hidden="true">
                      <CatalogImage
                        id={item.image}
                        alt=""
                        fallback={<ReviewIcon type="items" />}
                      />
                    </div>
                    <div className="review-item-details">
                      <strong>{item.title}</strong>
                      <span>تعداد: {faNumber.format(item.quantity)}</span>
                      <span>قیمت واحد: {formatMoney(item.saleRials)}</span>
                    </div>
                    <div className="review-item-total">
                      <span>جمع</span>
                      <strong>{formatMoney(item.lineRials)}</strong>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section
              className="review-card"
              aria-labelledby="review-recipient-heading"
            >
              <div className="review-card-header">
                <div className="review-heading">
                  <span className="review-icon">
                    <ReviewIcon type="address" />
                  </span>
                  <h2 id="review-recipient-heading">نشانی و گیرنده</h2>
                </div>
                <Link
                  className="review-edit"
                  href="/checkout/address"
                  aria-label="ویرایش نشانی و گیرنده"
                >
                  <ReviewIcon type="edit" />
                  ویرایش
                </Link>
              </div>
              <div className="review-address-label">{review.address.label}</div>
              <p className="review-address-text">{review.address.address}</p>
              {review.address.postalCode && (
                <p className="review-meta">
                  <span>کد پستی</span>
                  <bdi dir="ltr">{localDigits(review.address.postalCode)}</bdi>
                </p>
              )}
              <div className="review-recipient">
                <span className="review-meta-label">
                  <ReviewIcon type="person" /> گیرنده
                </span>
                <strong>{review.address.recipient}</strong>
                <span className="review-recipient-phone">
                  <ReviewIcon type="phone" />
                  <bdi dir="ltr">{localDigits(review.address.mobile)}</bdi>
                </span>
              </div>
              {(review.customer.name !== review.address.recipient ||
                review.customer.mobile !== review.address.mobile) && (
                <p className="review-meta">
                  <span>سفارش‌دهنده</span>
                  <span>
                    {review.customer.name} ·{" "}
                    <bdi dir="ltr">{localDigits(review.customer.mobile)}</bdi>
                  </span>
                </p>
              )}
            </section>
            <section
              className="review-card"
              aria-labelledby="review-delivery-heading"
            >
              <div className="review-card-header">
                <div className="review-heading">
                  <span className="review-icon">
                    <ReviewIcon type="delivery" />
                  </span>
                  <h2 id="review-delivery-heading">زمان تحویل</h2>
                </div>
                <Link
                  className="review-edit"
                  href="/checkout/address"
                  aria-label="ویرایش زمان تحویل"
                >
                  <ReviewIcon type="edit" />
                  ویرایش
                </Link>
              </div>
              <div className="review-delivery-value">
                <strong>
                  <bdi dir="ltr">{localDigits(review.delivery.date)}</bdi>
                </strong>
                <span>
                  {review.delivery.slot.label} ·{" "}
                  <bdi dir="ltr">
                    {localDigits(review.delivery.slot.start)}–
                    {localDigits(review.delivery.slot.end)}
                  </bdi>
                </span>
              </div>
            </section>
          </div>
          <section
            className="review-card order-review-prices"
            aria-labelledby="review-prices-heading"
          >
            <h2 id="review-prices-heading">خلاصه سفارش</h2>
            <PriceBreakdown
              subtotalRials={review.subtotalRials}
              discountRials={review.discountRials}
              itemsTotalRials={review.delivery.itemsTotalRials}
              shippingRials={review.delivery.shippingRials}
              totalRials={review.delivery.totalRials}
            />
            <p className="review-status">
              پرداخت در محیط آزمایشی آقای پرداخت انجام می‌شود و مبلغ واقعی کسر
              نمی‌شود.
            </p>
            {submitError && (
              <p role="alert" className="review-submit-error">
                {submitError}
              </p>
            )}
            <button
              className="catalog-button review-submit"
              type="button"
              disabled={submitting}
              onClick={() => void submitOrder()}
            >
              {submitting
                ? "در حال اتصال به درگاه…"
                : "ثبت سفارش و پرداخت آزمایشی"}
            </button>
            <Link className="review-back" href="/checkout/address">
              بازگشت به انتخاب ارسال
            </Link>
          </section>
        </div>
      )}
    </>
  );
}
