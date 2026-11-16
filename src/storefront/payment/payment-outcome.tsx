import Link from "next/link";
import type { PaymentState } from "@/modules/payment/outcome";
import { normalizeDigits } from "@/shared/locale";
const messages: Record<PaymentState, { title: string; description: string }> = {
  verified: {
    title: "پرداخت تأیید شد",
    description: "پرداخت شما با موفقیت تأیید شد.",
  },
  failed: {
    title: "پرداخت ناموفق بود",
    description: "پرداخت تأیید نشد. برای ادامه، وضعیت سفارش را بررسی کنید.",
  },
  pending: {
    title: "وضعیت پرداخت در حال بررسی است",
    description:
      "تا تأیید پرداخت، از پرداخت دوباره خودداری کنید و وضعیت سفارش را بررسی کنید.",
  },
};
/** Render only from an authenticated server-owned payment record, never URL or callback parameters. */
export function PaymentOutcome({
  state,
  orderCode,
  supportPhone,
  orderHref,
  retryHref,
}: {
  state: PaymentState;
  orderCode: string;
  supportPhone?: string;
  orderHref?: string;
  retryHref?: string;
}) {
  const text = messages[state];
  const number = supportPhone
    ? normalizeDigits(supportPhone).replace(/[\s()-]/g, "")
    : "";
  const safePhone = /^\+?\d{8,15}$/.test(number) ? number : "";
  return (
    <section className="payment-outcome" aria-labelledby="payment-result-title">
      <h1 id="payment-result-title">{text.title}</h1>
      <p role="status">{text.description}</p>
      <p>
        کد سفارش: <bdi dir="ltr">{orderCode}</bdi>
      </p>
      {safePhone && (
        <p>
          پشتیبانی:{" "}
          <a href={`tel:${safePhone}`}>
            <bdi dir="ltr">{supportPhone}</bdi>
          </a>
        </p>
      )}
      <div className="payment-outcome-actions">
        <Link href="/">بازگشت به خانه</Link>
        {orderHref && /^\/(?!\/)[^\\\s]*$/.test(orderHref) && (
          <Link href={orderHref}>مشاهده سفارش</Link>
        )}
        {state === "failed" &&
          retryHref &&
          /^\/(?!\/)[^\\\s]*$/.test(retryHref) && (
            <Link href={retryHref}>بررسی دوباره سفارش</Link>
          )}
      </div>
    </section>
  );
}
