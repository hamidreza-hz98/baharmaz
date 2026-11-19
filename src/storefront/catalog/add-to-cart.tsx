"use client";
import { useCallback, useEffect, useState } from "react";
import {
  cartChangedEvent,
  cartRequest,
  notifyCartChanged,
  syncCart,
} from "@/storefront/cart/client";

type CartData = { items?: { productId: string; quantity: number }[] };
function ControlIcon({ kind }: { kind: "add" | "remove" | "delete" }) {
  if (kind === "delete")
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
      </svg>
    );
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M5 12h14" />
      {kind === "add" && <path d="M12 5v14" />}
    </svg>
  );
}

export function AddToCart({
  id,
  available,
}: {
  id: string;
  available: boolean;
}) {
  const [quantity, setQuantity] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const updateFromCart = useCallback(
    (cart: CartData) => {
      setQuantity(
        cart.items?.find((item) => item.productId === id)?.quantity ?? 0,
      );
    },
    [id],
  );

  useEffect(() => {
    let active = true;
    const refresh = (event?: Event) => {
      const cart = (event as CustomEvent<CartData> | undefined)?.detail;
      if (cart) updateFromCart(cart);
      else
        void fetch("/api/cart", { cache: "no-store" })
          .then((r) => r.json())
          .then((data: CartData) => {
            if (active) updateFromCart(data);
          })
          .catch(() => {});
    };
    window.addEventListener(cartChangedEvent, refresh);
    refresh();
    return () => {
      active = false;
      window.removeEventListener(cartChangedEvent, refresh);
    };
  }, [updateFromCart]);

  async function mutate(
    action: "add" | "set" | "remove",
    nextQuantity?: number,
  ) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await syncCart();
      const cart = (await cartRequest({
        action,
        productId: id,
        ...(action === "add" ? { quantity: nextQuantity ?? 1 } : {}),
        ...(action === "set" ? { quantity: nextQuantity } : {}),
      })) as CartData;
      updateFromCart(cart);
      notifyCartChanged(cart);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "عملیات سبد ممکن نشد.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {quantity > 0 ? (
        <div className="catalog-quantity" aria-label="تعداد محصول در سبد خرید">
          <button
            type="button"
            aria-label={quantity === 1 ? "حذف از سبد خرید" : "کاهش تعداد"}
            disabled={busy}
            onClick={() =>
              void mutate(quantity === 1 ? "remove" : "set", quantity - 1)
            }
          >
            <ControlIcon kind={quantity === 1 ? "delete" : "remove"} />
          </button>
          <span aria-live="polite">
            {new Intl.NumberFormat("fa-IR").format(quantity)}
          </span>
          <button
            type="button"
            aria-label="افزایش تعداد"
            disabled={busy || !available}
            onClick={() => void mutate("add")}
          >
            <ControlIcon kind="add" />
          </button>
        </div>
      ) : (
        <button
          className="catalog-button"
          type="button"
          disabled={!available || busy}
          onClick={() => void mutate("add")}
        >
          {available
            ? busy
              ? "در حال افزودن…"
              : "افزودن به سبد خرید"
            : "ناموجود"}
        </button>
      )}
      <span className="cart-feedback" role="status">
        {message}
      </span>
    </div>
  );
}
