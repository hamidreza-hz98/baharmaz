"use client";
import { useState } from "react";
import { cartRequest, syncCart } from "@/storefront/cart/client";
export function AddToCart({
  id,
  available,
}: {
  id: string;
  available: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function add() {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await syncCart();
      await cartRequest({ action: "add", productId: id, quantity: 1 });
      setMessage("به سبد خرید اضافه شد.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "افزودن به سبد ممکن نشد.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <button
        className="catalog-button"
        type="button"
        disabled={!available || busy}
        onClick={() => void add()}
      >
        {available
          ? busy
            ? "در حال افزودن…"
            : "افزودن به سبد خرید"
          : "ناموجود"}
      </button>
      <span className="cart-feedback" role="status">
        {message}
      </span>
    </div>
  );
}
