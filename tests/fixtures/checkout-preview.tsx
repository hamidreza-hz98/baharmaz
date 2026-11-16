import { CheckoutSteps } from "@/storefront/checkout/checkout-steps";
import { AddressSelector } from "@/storefront/checkout/address-selector";
export default function Preview() {
  return (
    <main className="store-content">
      <CheckoutSteps current="address" />
      <AddressSelector />
    </main>
  );
}
