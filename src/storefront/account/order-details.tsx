/* eslint-disable @next/next/no-img-element -- Private snapshot images use the authenticated media route. */
"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import TagIcon from "@mui/icons-material/Tag";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import { PriceBreakdown } from "@/storefront/cart/price-breakdown";
import { formatMoney, formatTehranJalali } from "@/shared/locale";
type Order = {
  code: string;
  isTest: boolean;
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
      <div className="order-detail-heading">
        <h1>جزئیات سفارش</h1>
        <Link className="review-edit" href="/account">
          <ArrowForwardIcon aria-hidden="true" /> بازگشت به سفارش‌ها
        </Link>
      </div>
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
          {order.isTest && (
            <p className="sandbox-result-badge">
              سفارش آزمایشی است؛ پرداخت واقعی انجام نشده است.
            </p>
          )}
          <div className="order-detail-layout">
            <div className="review-details">
              <section
                className="review-card"
                aria-labelledby="order-status-title"
              >
                <div className="review-heading">
                  <span className="review-icon">
                    <ReceiptLongIcon aria-hidden="true" />
                  </span>
                  <h2 id="order-status-title">اطلاعات سفارش</h2>
                </div>
                <div className="order-detail-status">
                  <span
                    className={`order-status ${order.status === "delivered" ? "is-success" : order.status === "cancelled" ? "is-failure" : "is-pending"}`}
                  >
                    {statusNames[order.status] || "وضعیت نامشخص"}
                  </span>
                </div>
                <div className="order-detail-rows">
                  <div>
                    <span>
                      <TagIcon aria-hidden="true" /> کد سفارش
                    </span>
                    <strong>
                      <bdi dir="ltr">{order.code}</bdi>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <EventOutlinedIcon aria-hidden="true" /> تاریخ ثبت
                    </span>
                    <strong>{formatTehranJalali(order.placedAt)}</strong>
                  </div>
                </div>
              </section>
              <section
                className="review-card"
                aria-labelledby="order-items-title"
              >
                <div className="review-heading">
                  <span className="review-icon">
                    <Inventory2OutlinedIcon aria-hidden="true" />
                  </span>
                  <h2 id="order-items-title">محصولات سفارش</h2>
                </div>
                <ul className="review-items">
                  {order.items.map((item, index) => (
                    <li key={`${item.imageId}-${index}`}>
                      <div className="review-item-image" aria-hidden="true">
                        {item.imageId ? (
                          <img
                            src={`/api/account/orders/${encodeURIComponent(order.code)}/media/${item.imageId}`}
                            alt=""
                          />
                        ) : (
                          <Inventory2OutlinedIcon />
                        )}
                      </div>
                      <div className="review-item-details">
                        <strong>{item.title}</strong>
                        <span>
                          تعداد:{" "}
                          {new Intl.NumberFormat("fa-IR").format(item.quantity)}
                        </span>
                        <span>قیمت واحد: {formatMoney(item.unitRials)}</span>
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
                aria-labelledby="order-address-title"
              >
                <div className="review-heading">
                  <span className="review-icon">
                    <LocationOnOutlinedIcon aria-hidden="true" />
                  </span>
                  <h2 id="order-address-title">نشانی و زمان تحویل</h2>
                </div>
                <p className="review-address-text">
                  {order.address.address || "نشانی ثبت نشده است."}
                </p>
                <div className="order-detail-rows">
                  <div>
                    <span>
                      <PersonOutlinedIcon aria-hidden="true" /> گیرنده
                    </span>
                    <strong>{order.address.recipient || "ثبت نشده"}</strong>
                  </div>
                  <div>
                    <span>
                      <PhoneOutlinedIcon aria-hidden="true" /> شماره همراه
                    </span>
                    <strong>
                      <bdi dir="ltr">{order.address.mobile || "ثبت نشده"}</bdi>
                    </strong>
                  </div>
                  {order.address.postalCode && (
                    <div>
                      <span>
                        <TagIcon aria-hidden="true" /> کد پستی
                      </span>
                      <strong>
                        <bdi dir="ltr">{order.address.postalCode}</bdi>
                      </strong>
                    </div>
                  )}
                  <div>
                    <span>
                      <EventOutlinedIcon aria-hidden="true" /> تاریخ تحویل
                    </span>
                    <strong>
                      <bdi dir="ltr">{order.delivery.date || "ثبت نشده"}</bdi>
                    </strong>
                  </div>
                  {order.delivery.slotLabel && (
                    <div>
                      <span>
                        <LocalShippingOutlinedIcon aria-hidden="true" /> بازه
                        تحویل
                      </span>
                      <strong>{order.delivery.slotLabel}</strong>
                    </div>
                  )}
                </div>
              </section>
            </div>
            <section
              className="review-card order-review-prices order-detail-summary"
              aria-labelledby="order-summary-title"
            >
              <div className="review-heading">
                <span className="review-icon">
                  <PaymentOutlinedIcon aria-hidden="true" />
                </span>
                <h2 id="order-summary-title">خلاصه پرداخت</h2>
              </div>
              <div className="order-payment-info">
                <span>
                  <PaymentOutlinedIcon aria-hidden="true" /> وضعیت پرداخت
                </span>
                <strong>
                  {order.payment.status === "sandbox_verified"
                    ? "آزمایشی موفق"
                    : order.payment.status === "verified"
                      ? "تأیید شده"
                      : order.payment.status === "failed"
                        ? "ناموفق"
                        : "در انتظار تأیید"}
                </strong>
              </div>
              {order.payment.transactionReference && (
                <div className="order-payment-info">
                  <span>
                    <TagIcon aria-hidden="true" /> شماره تراکنش
                  </span>
                  <strong>
                    <bdi dir="ltr">{order.payment.transactionReference}</bdi>
                  </strong>
                </div>
              )}
              <div className="order-price-breakdown cart-totals">
                {order.totals.subtotalRials !== null &&
                order.totals.discountRials !== null &&
                order.totals.shippingRials !== null &&
                order.totals.totalRials !== null ? (
                  <PriceBreakdown
                    subtotalRials={order.totals.subtotalRials}
                    discountRials={order.totals.discountRials}
                    itemsTotalRials={
                      order.totals.subtotalRials - order.totals.discountRials
                    }
                    shippingRials={order.totals.shippingRials}
                    totalRials={order.totals.totalRials}
                  />
                ) : (
                  <>
                    <div>
                      <span>جمع کالاها</span>
                      <strong>{amount(order.totals.subtotalRials)}</strong>
                    </div>
                    <div className="price-discount">
                      <span>تخفیف</span>
                      <strong>{amount(order.totals.discountRials)}</strong>
                    </div>
                    <div
                      className={
                        order.totals.shippingRials === null
                          ? undefined
                          : "price-shipping"
                      }
                    >
                      <span>هزینه ارسال</span>
                      <strong>{amount(order.totals.shippingRials)}</strong>
                    </div>
                    <div className="price-total">
                      <span>مبلغ نهایی</span>
                      <strong>{amount(order.totals.totalRials)}</strong>
                    </div>
                  </>
                )}
              </div>
              {!order.isTest && (
                <div>
                  <span>مبلغ پرداخت‌شده</span>
                  <strong>{amount(order.totals.paidRials)}</strong>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </>
  );
}
