"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormControl, MenuItem, Select } from "@mui/material";
import type { AddressItem } from "@/shared/address";
import { AddressBook } from "@/storefront/addresses/address-book";
import { PriceBreakdown } from "@/storefront/cart/price-breakdown";
type Slot = {
  id: string;
  label: string;
  start: string;
  end: string;
  available: boolean;
  reason: string | null;
};
type Day = { date: string; label: string; slots: Slot[] };
type Options = {
  status: string;
  days: Day[];
  zone?: { id: string; name: string };
};
type Quote = {
  token: string;
  date: string;
  slot: Slot;
  zone: string;
  shippingRials: number;
  itemsTotalRials: number;
  totalRials: number;
  expiresAt: string;
};
type CartSummary = {
  subtotalRials: number;
  discountRials: number;
  itemsTotalRials: number;
};
const statuses: Record<string, string> = {
  not_configured: "قوانین و هزینه ارسال هنوز تنظیم نشده است.",
  coordinates_required:
    "برای بررسی محدوده، موقعیت نشانی را در بخش مدیریت نشانی ثبت کنید.",
  outside: "این نشانی خارج از محدوده ارسال است.",
  ambiguous: "محدوده ارسال مشخص نیست؛ با فروشگاه تماس بگیرید.",
};
export function AddressSelector() {
  const router = useRouter();
  const [items, setItems] = useState<AddressItem[] | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [deliveryError, setDeliveryError] = useState("");
  const [cart, setCart] = useState<CartSummary | null>(null);
  const [cartError, setCartError] = useState(false);
  const epoch = useRef(0);
  async function load(restoreSelection = true) {
    try {
      const response = await fetch("/api/addresses", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setItems(data.items);
      setError("");
      try {
        const saved = sessionStorage.getItem("lamsechi-checkout-address");
        if (
          restoreSelection &&
          saved &&
          data.items.some((item: AddressItem) => item.id === saved)
        )
          void select(saved);
      } catch {
        /* Browsing without storage remains possible. */
      }
    } catch {
      setError("دریافت نشانی‌ها ممکن نشد.");
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
    // Restore the saved selection only when this checkout screen mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function loadCart() {
    try {
      const response = await fetch("/api/cart", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setCart(await response.json());
      setCartError(false);
    } catch {
      setCartError(true);
    }
  }
  useEffect(() => {
    const timer = setTimeout(() => void loadCart(), 0);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!quote) return;
    const delay = Math.max(0, new Date(quote.expiresAt).getTime() - Date.now());
    const timer = setTimeout(() => {
      setQuote(null);
      setDeliveryError("پیش‌فاکتور ارسال منقضی شد؛ دوباره محاسبه کنید.");
    }, delay);
    return () => clearTimeout(timer);
  }, [quote]);
  async function select(addressId = selected) {
    if (!addressId) return;
    const request = ++epoch.current;
    setSelected(addressId);
    setBusy(true);
    setDeliveryError("");
    setOptions(null);
    setQuote(null);
    setDate("");
    setSlot("");
    setNotice("");
    try {
      const response = await fetch("/api/addresses", { cache: "no-store" });
      if (!response.ok)
        throw new Error("بررسی نشانی ممکن نشد؛ دوباره تلاش کنید.");
      const data = await response.json();
      if (request !== epoch.current) return;
      setItems(data.items);
      if (!data.items.some((item: AddressItem) => item.id === addressId)) {
        setSelected("");
        setNotice("این نشانی دیگر در دسترس نیست؛ نشانی دیگری انتخاب کنید.");
        return;
      }
      try {
        sessionStorage.setItem("lamsechi-checkout-address", addressId);
      } catch {
        /* Selection still works in this tab. */
      }
      setNotice("نشانی انتخاب شد.");
      const res = await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "options", addressId }),
      });
      const result = await res.json();
      if (request !== epoch.current) return;
      if (!res.ok)
        throw new Error(result.error || "دریافت زمان‌های ارسال ممکن نشد.");
      setOptions(result);
    } catch (e) {
      if (request === epoch.current)
        setDeliveryError(
          e instanceof Error ? e.message : "بررسی ارسال ممکن نشد.",
        );
    } finally {
      if (request === epoch.current) setBusy(false);
    }
  }
  async function calculate(selectedDate = date, selectedSlot = slot) {
    const request = ++epoch.current;
    setBusy(true);
    setDeliveryError("");
    setQuote(null);
    try {
      const res = await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "quote",
          addressId: selected,
          date: selectedDate,
          slotId: selectedSlot,
        }),
      });
      const data = await res.json();
      if (request !== epoch.current) return;
      if (!res.ok)
        throw new Error(data.error || "محاسبه هزینه ارسال ممکن نشد.");
      setQuote(data);
    } catch (e) {
      if (request === epoch.current)
        setDeliveryError(
          e instanceof Error ? e.message : "محاسبه ارسال ممکن نشد.",
        );
    } finally {
      if (request === epoch.current) setBusy(false);
    }
  }
  async function openReview() {
    if (!quote || busy) return;
    setBusy(true);
    setDeliveryError("");
    try {
      const response = await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", token: quote.token }),
      });
      const data = await response.json();
      if (!response.ok) {
        setQuote(null);
        throw new Error(data.error || "پیش‌فاکتور تغییر کرده است.");
      }
      sessionStorage.setItem("lamsechi-delivery-quote", quote.token);
      router.push("/checkout/review");
    } catch (error) {
      setDeliveryError(
        error instanceof Error ? error.message : "بررسی پیش‌فاکتور ممکن نشد.",
      );
    } finally {
      setBusy(false);
    }
  }
  const days = options?.days ?? [];
  const chosen = days.find((d) => d.date === date);
  return (
    <>
      <h1>انتخاب نشانی و زمان</h1>
      <div className="checkout-address-layout">
        <div className="checkout-address-main">
          {items?.length !== 0 && <p>نشانی تحویل را انتخاب کنید.</p>}
          {error && (
            <p role="alert">
              {error}{" "}
              <button type="button" onClick={() => void load()}>
                تلاش دوباره
              </button>
            </p>
          )}
          {!items && !error && <p role="status">در حال دریافت نشانی‌ها…</p>}
          {items?.length === 0 && (
            <section
              className="checkout-address-empty"
              aria-labelledby="checkout-address-empty-title"
            >
              <div className="checkout-address-empty-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 64 64"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M32 55s17-15.2 17-29a17 17 0 1 0-34 0c0 13.8 17 29 17 29Z"
                    fill="#f7e5dd"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx="32"
                    cy="26"
                    r="6.5"
                    fill="white"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M14 52c-3 1.1-5 2.5-5 4 0 3.3 10.3 6 23 6s23-2.7 23-6c0-1.5-2-2.9-5-4"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    opacity=".45"
                  />
                </svg>
              </div>
              <h2 id="checkout-address-empty-title">
                هنوز نشانی‌ای ثبت نکرده‌اید
              </h2>
              <p>
                برای انتخاب زمان تحویل، ابتدا نشانی دریافت سفارش را اضافه کنید.
              </p>
              <button
                className="checkout-address-add"
                type="button"
                onClick={() => setAddingAddress(true)}
              >
                <span aria-hidden="true">＋</span> افزودن نشانی
              </button>
            </section>
          )}
          {items && items.length > 0 && (
            <p>
              <Link
                className="checkout-address-add checkout-address-manage"
                href="/account/addresses"
              >
                <span aria-hidden="true">＋</span>
                مدیریت و افزودن نشانی
              </Link>
            </p>
          )}
          {items && items.length > 0 && (
            <fieldset className="checkout-address-list">
              <legend>نشانی‌های من</legend>
              {items.map((item) => (
                <label key={item.id} className="checkout-address-option">
                  <input
                    type="radio"
                    name="checkout-address"
                    value={item.id}
                    checked={selected === item.id}
                    onChange={() => {
                      void select(item.id);
                    }}
                  />
                  <span>
                    <strong>{item.label}</strong>
                    <br />
                    {item.address}
                    <br />
                    {item.recipient} · <bdi dir="ltr">{item.mobile}</bdi>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
          {busy && selected && !options && (
            <p role="status">در حال بررسی نشانی…</p>
          )}
          {notice && <p role="status">{notice}</p>}
          {deliveryError && (
            <p role="alert">
              {deliveryError}{" "}
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void (options?.status === "covered" && date && slot
                    ? calculate()
                    : select())
                }
              >
                بررسی دوباره
              </button>
            </p>
          )}
          {options && options.status !== "covered" && (
            <p role="status">
              {statuses[options.status] ||
                "ارسال برای این نشانی در دسترس نیست."}{" "}
              <button
                type="button"
                disabled={busy}
                onClick={() => void select()}
              >
                بررسی دوباره
              </button>
            </p>
          )}
          {options?.status === "covered" && (
            <section className="delivery-selection">
              <h2>زمان تحویل</h2>
              {!days.some((d) => d.slots.some((s) => s.available)) ? (
                <p>در حال حاضر زمان تحویلی در دسترس نیست.</p>
              ) : (
                <>
                  <label id="delivery-date-label">
                    تاریخ تحویل (هجری شمسی)
                  </label>
                  <FormControl fullWidth size="small">
                    <Select
                      id="delivery-date"
                      labelId="delivery-date-label"
                      value={date}
                      displayEmpty
                      className="delivery-date-select"
                      MenuProps={{
                        slotProps: {
                          paper: {
                            className: "delivery-date-menu",
                            sx: {
                              maxHeight: 320,
                              mt: 0.75,
                              borderRadius: 2.5,
                              border: "1px solid #eadfd8",
                              boxShadow: "0 12px 32px rgb(62 35 29 / 16%)",
                            },
                          },
                        },
                      }}
                      onChange={(e) => {
                        epoch.current++;
                        setBusy(false);
                        setDate(e.target.value);
                        setSlot("");
                        setQuote(null);
                        setDeliveryError("");
                      }}
                    >
                      <MenuItem value="" disabled>
                        انتخاب تاریخ
                      </MenuItem>
                      {days.map((d) => (
                        <MenuItem
                          key={d.date}
                          value={d.date}
                          disabled={!d.slots.some((s) => s.available)}
                        >
                          {d.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {chosen && (
                    <fieldset>
                      <legend>بازه تحویل</legend>
                      {chosen.slots.map((s) => (
                        <label className="delivery-slot" key={s.id}>
                          <input
                            type="radio"
                            name="delivery-slot"
                            value={s.id}
                            disabled={!s.available}
                            checked={slot === s.id}
                            onChange={() => {
                              setSlot(s.id);
                              setQuote(null);
                              void calculate(date, s.id);
                            }}
                          />
                          <span>
                            {s.label}{" "}
                            <bdi dir="ltr">
                              {s.start}–{s.end}
                            </bdi>
                            {!s.available && " (غیرفعال)"}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  )}
                </>
              )}
            </section>
          )}
        </div>
        <section
          className="cart-totals checkout-summary"
          aria-label="خلاصه سبد خرید"
        >
          <h2>خلاصه سبد خرید</h2>
          {cart ? (
            <PriceBreakdown
              subtotalRials={cart.subtotalRials}
              discountRials={cart.discountRials}
              itemsTotalRials={quote?.itemsTotalRials ?? cart.itemsTotalRials}
              shippingRials={quote?.shippingRials ?? null}
              totalRials={quote?.totalRials ?? null}
              shippingPending={
                busy && slot
                  ? "در حال محاسبه…"
                  : "در انتظار انتخاب نشانی و زمان"
              }
            />
          ) : cartError ? (
            <p role="alert">
              دریافت خلاصه سبد ممکن نشد.{" "}
              <button type="button" onClick={() => void loadCart()}>
                تلاش دوباره
              </button>
            </p>
          ) : (
            <p role="status">در حال دریافت خلاصه سبد خرید…</p>
          )}
          <button
            type="button"
            className="catalog-button"
            disabled={!cart || !selected || !date || !slot || !quote || busy}
            onClick={() => void openReview()}
          >
            {busy && quote ? "در حال بررسی…" : "مرحله بعد"}
          </button>
          <p className="checkout-back-link">
            <Link href="/cart">بازگشت به سبد خرید</Link>
          </p>
        </section>
      </div>
      {addingAddress && (
        <AddressBook
          createOnly
          onClose={() => setAddingAddress(false)}
          onCreated={async (item) => {
            await load(false);
            if (item?.id) void select(item.id);
          }}
        />
      )}
    </>
  );
}
