export function CheckoutSteps({ current }: { current: "cart" | "address" }) {
  return (
    <nav aria-label="مراحل خرید">
      <ol className="checkout-steps">
        <li aria-current={current === "cart" ? "step" : undefined}>
          <span>۱</span>سبد خرید
        </li>
        <li aria-current={current === "address" ? "step" : undefined}>
          <span>۲</span>نشانی و زمان
        </li>
        <li>
          <span>۳</span>تأیید نهایی
        </li>
      </ol>
    </nav>
  );
}
