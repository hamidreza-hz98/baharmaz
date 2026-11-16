"use client";
import { useState } from "react";
import { OrderHistory } from "@/storefront/account/order-history";
import { OrderDetails } from "@/storefront/account/order-details";
export default function Preview() {
  const [details, setDetails] = useState(false);
  return (
    <main className="store-content">
      <button onClick={() => setDetails(!details)}>تغییر نمای سفارش</button>
      {details ? <OrderDetails code="TEST-1" /> : <OrderHistory />}
    </main>
  );
}
