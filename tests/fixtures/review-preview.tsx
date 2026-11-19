import { OrderReview } from "@/storefront/checkout/order-review";
import { CheckoutSteps } from "@/storefront/checkout/checkout-steps";

export default function Page() {
  return (
    <main className="store-content">
      <CheckoutSteps current="review" />
      <OrderReview />
    </main>
  );
}
