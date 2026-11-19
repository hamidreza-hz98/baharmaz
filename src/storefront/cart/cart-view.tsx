"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { formatMoney } from "@/shared/locale";
import { CustomerAuthDialog } from "@/storefront/auth/customer-auth-dialog";
import { CatalogImage } from "@/storefront/catalog/catalog-image";
import { CheckoutSteps } from "@/storefront/checkout/checkout-steps";
import { cartRequest, notifyCartChanged, syncCart } from "./client";
import { PriceBreakdown } from "./price-breakdown";
type Item = {
  productId: string;
  title: string;
  slug: string | null;
  image: string | null;
  quantity: number;
  status: "available" | "unavailable" | "removed";
  priceChanged: boolean;
  quantityCapped: boolean;
  regularRials: number | null;
  saleRials: number | null;
  lineRials: number | null;
};
type Cart = {
  items: Item[];
  subtotalRials: number;
  discountRials: number;
  itemsTotalRials: number;
  shippingRials: number | null;
  totalRials: number | null;
};
type Identity = "loading" | "customer" | "guest" | "error";
function ready(cart: Cart) {
  return (
    cart.items.length > 0 &&
    cart.items.every(
      (item) =>
        item.status === "available" &&
        !item.priceChanged &&
        !item.quantityCapped,
    )
  );
}
export function CartView() {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeItem, setRemoveItem] = useState<Item | null>(null);
  const [identity, setIdentity] = useState<Identity>("loading");
  const load = useCallback(async () => {
    try {
      await syncCart();
      const [res, account] = await Promise.all([
        fetch("/api/cart", { cache: "no-store" }),
        fetch("/api/account", { cache: "no-store" }),
      ]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCart(data);
      notifyCartChanged(data);
      setIdentity(
        account.ok ? "customer" : account.status === 401 ? "guest" : "error",
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت سبد ممکن نشد.");
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  async function change(action: string, item: Item, quantity?: number) {
    if (busy) return;
    setBusy(true);
    try {
      const data = await cartRequest({
        action,
        productId: item.productId,
        ...(quantity === undefined ? {} : { quantity }),
      });
      setCart(data);
      notifyCartChanged(data);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "عملیات ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }
  async function selectAddress() {
    if (busy) return;
    setBusy(true);
    try {
      const [cartResponse, account] = await Promise.all([
        fetch("/api/cart", { cache: "no-store" }),
        fetch("/api/account", { cache: "no-store" }),
      ]);
      const latest: Cart = await cartResponse.json();
      if (!cartResponse.ok) throw new Error("بررسی سبد ممکن نشد.");
      setCart(latest);
      notifyCartChanged(latest);
      if (!ready(latest)) {
        setError(
          "سبد تغییر کرده است؛ موارد ناموجود، تعداد یا قیمت جدید را بررسی کنید.",
        );
        return;
      }
      if (account.status === 401) {
        setIdentity("guest");
        setError("برای انتخاب نشانی ابتدا وارد شوید.");
        return;
      }
      if (!account.ok)
        throw new Error("بررسی ورود ممکن نشد؛ دوباره تلاش کنید.");
      setIdentity("customer");
      setError("");
      router.push("/checkout/address");
    } catch (e) {
      setError(e instanceof Error ? e.message : "بررسی سبد ممکن نشد.");
    } finally {
      setBusy(false);
    }
  }
  const blocked = !cart || !ready(cart) || busy || Boolean(error);
  return (
    <>
      <CheckoutSteps current="cart" />
      <h1>سبد خرید</h1>
      {error && (
        <p role="alert" className="cart-error">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            تازه‌سازی سبد
          </button>
        </p>
      )}
      {!cart && !error && <p role="status">در حال دریافت سبد خرید…</p>}
      {cart && cart.items.length === 0 && (
        <div className="cart-empty">
          <p>سبد خرید شما خالی است.</p>
          <Link href="/products">مشاهده محصولات</Link>
        </div>
      )}
      {cart && cart.items.length > 0 && (
        <div className="cart-layout">
          <div className="cart-lines">
            {cart.items.map((item) => (
              <article className="cart-line" key={item.productId}>
                <div className="cart-line-image">
                  <CatalogImage id={item.image} />
                </div>
                <div className="cart-line-content">
                  <h2>
                    {item.slug ? (
                      <Link href={`/products/${encodeURIComponent(item.slug)}`}>
                        {item.title}
                      </Link>
                    ) : (
                      item.title
                    )}
                  </h2>
                  {item.status !== "available" ? (
                    <p role="status">
                      این محصول{" "}
                      {item.status === "removed" ? "حذف شده" : "ناموجود"} است و
                      در جمع محاسبه نمی‌شود؛ برای ادامه آن را حذف کنید.
                    </p>
                  ) : (
                    <>
                      <p>
                        {item.regularRials !== item.saleRials && (
                          <del>{formatMoney(item.regularRials!)}</del>
                        )}{" "}
                        <strong>{formatMoney(item.saleRials!)}</strong> برای هر
                        عدد
                      </p>
                      {item.priceChanged && (
                        <p role="status">
                          قیمت محصول تغییر کرده است.{" "}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void change("acknowledge", item)}
                          >
                            تأیید قیمت جدید
                          </button>
                        </p>
                      )}
                      {item.quantityCapped && (
                        <p role="status">
                          تعداد ادغام‌شده به سقف ۹۹ عدد محدود شد.{" "}
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void change("set", item, item.quantity)
                            }
                          >
                            تأیید تعداد
                          </button>
                        </p>
                      )}
                    </>
                  )}
                  {item.status !== "available" && (
                    <button
                      type="button"
                      className="cart-remove-button"
                      disabled={busy}
                      aria-label={`حذف ${item.title}`}
                      onClick={() => setRemoveItem(item)}
                    >
                      <TrashIcon />
                    </button>
                  )}
                </div>
                {item.status === "available" && (
                  <div className="cart-line-actions">
                    <div
                      aria-label={`تعداد ${item.title}`}
                      className="cart-quantity"
                    >
                      <button
                        type="button"
                        className="cart-remove-button"
                        disabled={busy}
                        aria-label={`حذف ${item.title}`}
                        onClick={() => setRemoveItem(item)}
                      >
                        <TrashIcon />
                      </button>
                      {item.quantity > 1 && (
                        <button
                          type="button"
                          aria-label={`کاهش تعداد ${item.title}`}
                          disabled={busy}
                          onClick={() =>
                            void change("set", item, item.quantity - 1)
                          }
                        >
                          −
                        </button>
                      )}
                      <span aria-live="polite">
                        {new Intl.NumberFormat("fa-IR").format(item.quantity)}
                      </span>
                      <button
                        type="button"
                        aria-label={`افزایش تعداد ${item.title}`}
                        disabled={busy || item.quantity >= 99}
                        onClick={() =>
                          void change("set", item, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                    <p className="cart-line-total">
                      جمع: {formatMoney(item.lineRials!)}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
          <section className="cart-totals" aria-label="خلاصه سبد">
            <h2>خلاصه سبد خرید</h2>
            <PriceBreakdown {...cart} />
            {!ready(cart) && <p>برای ادامه، موارد سبد را بررسی کنید.</p>}
            {identity === "guest" ? (
              <CustomerAuthDialog
                triggerLabel="انتخاب آدرس"
                disabled={blocked}
                onAuthenticated={selectAddress}
              />
            ) : (
              <button
                className="catalog-button"
                type="button"
                disabled={blocked || identity !== "customer"}
                onClick={() => void selectAddress()}
              >
                {identity === "loading" ? "در حال بررسی ورود…" : "انتخاب آدرس"}
              </button>
            )}
            {identity === "error" && (
              <p role="status">بررسی ورود ممکن نشد؛ سبد را تازه کنید.</p>
            )}
          </section>
        </div>
      )}
      <Dialog
        open={removeItem !== null}
        onClose={() => {
          if (!busy) setRemoveItem(null);
        }}
        aria-labelledby="cart-remove-title"
        aria-describedby="cart-remove-description"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="cart-remove-title">حذف محصول از سبد خرید</DialogTitle>
        <DialogContent>
          <DialogContentText id="cart-remove-description">
            آیا می‌خواهید «{removeItem?.title}» را از سبد خرید حذف کنید؟
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setRemoveItem(null)} disabled={busy} autoFocus>
            انصراف
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => {
              if (!removeItem) return;
              void change("remove", removeItem);
              setRemoveItem(null);
            }}
          >
            حذف محصول
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6" />
    </svg>
  );
}
