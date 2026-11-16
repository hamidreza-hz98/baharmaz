"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/shared/locale";
import type { AddressItem } from "@/shared/address";
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
  const [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [options, setOptions] = useState<Options | null>(null);
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [deliveryError, setDeliveryError] = useState("");
  const epoch = useRef(0);
  async function load() {
    try {
      const response = await fetch("/api/addresses", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setItems(data.items);
      setError("");
      try {
        const saved = sessionStorage.getItem("lamsechi-checkout-address");
        if (data.items.some((item: AddressItem) => item.id === saved))
          setSelected(saved || "");
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
  async function select() {
    const request = ++epoch.current;
    setBusy(true);
    setDeliveryError("");
    setOptions(null);
    setQuote(null);
    setDate("");
    setSlot("");
    try {
      const response = await fetch("/api/addresses", { cache: "no-store" });
      if (!response.ok)
        throw new Error("بررسی نشانی ممکن نشد؛ دوباره تلاش کنید.");
      const data = await response.json();
      if (request !== epoch.current) return;
      setItems(data.items);
      if (!data.items.some((item: AddressItem) => item.id === selected)) {
        setSelected("");
        setNotice("این نشانی دیگر در دسترس نیست؛ نشانی دیگری انتخاب کنید.");
        return;
      }
      try {
        sessionStorage.setItem("lamsechi-checkout-address", selected);
      } catch {
        /* Selection still works in this tab. */
      }
      setNotice("نشانی انتخاب شد.");
      const res = await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "options", addressId: selected }),
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
  async function calculate() {
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
          date,
          slotId: slot,
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
  async function revalidate() {
    if (!quote) return;
    const request = ++epoch.current;
    setBusy(true);
    setDeliveryError("");
    try {
      const res = await fetch("/api/delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "validate", token: quote.token }),
      });
      const data = await res.json();
      if (request !== epoch.current) return;
      if (!res.ok) {
        setQuote(null);
        throw new Error(data.error || "پیش‌فاکتور تغییر کرده است.");
      }
      setNotice("پیش‌فاکتور بررسی شد. ثبت سفارش در مرحله بعد فراهم می‌شود.");
    } catch (e) {
      if (request === epoch.current)
        setDeliveryError(
          e instanceof Error ? e.message : "بررسی پیش‌فاکتور ممکن نشد.",
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
  function resetDelivery() {
    epoch.current++;
    setBusy(false);
    setOptions(null);
    setQuote(null);
    setDate("");
    setSlot("");
    setNotice("");
    setDeliveryError("");
  }
  const days = options?.days ?? [];
  const chosen = days.find((d) => d.date === date);
  return (
    <>
      <h1>انتخاب نشانی و زمان</h1>
      <p>نشانی تحویل را انتخاب کنید.</p>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => void load()}>
            تلاش دوباره
          </button>
        </p>
      )}
      {!items && !error && <p role="status">در حال دریافت نشانی‌ها…</p>}
      {items?.length === 0 && <p>هنوز نشانی‌ای ثبت نشده است.</p>}
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
                  resetDelivery();
                  setSelected(item.id);
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
          <button
            type="button"
            className="catalog-button"
            disabled={!selected || busy}
            onClick={() => void select()}
          >
            {busy && !options ? "در حال بررسی…" : "تأیید نشانی"}
          </button>
        </fieldset>
      )}
      {notice && <p role="status">{notice}</p>}
      {deliveryError && (
        <p role="alert">
          {deliveryError}{" "}
          <button type="button" disabled={busy} onClick={() => void select()}>
            بررسی دوباره
          </button>
        </p>
      )}
      {options && options.status !== "covered" && (
        <p role="status">
          {statuses[options.status] || "ارسال برای این نشانی در دسترس نیست."}
        </p>
      )}
      {options?.status === "covered" && (
        <section className="delivery-selection">
          <h2>زمان تحویل</h2>
          {!days.some((d) => d.slots.some((s) => s.available)) ? (
            <p>در حال حاضر زمان تحویلی در دسترس نیست.</p>
          ) : (
            <>
              <label htmlFor="delivery-date">تاریخ تحویل (هجری شمسی)</label>
              <select
                id="delivery-date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  setSlot("");
                  setQuote(null);
                }}
              >
                <option value="">انتخاب تاریخ</option>
                {days.map((d) => (
                  <option
                    key={d.date}
                    value={d.date}
                    disabled={!d.slots.some((s) => s.available)}
                  >
                    {d.label}
                  </option>
                ))}
              </select>
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
              <button
                className="catalog-button"
                type="button"
                disabled={!date || !slot || busy}
                onClick={() => void calculate()}
              >
                {busy ? "در حال محاسبه…" : "محاسبه هزینه ارسال"}
              </button>
            </>
          )}
        </section>
      )}
      {quote && (
        <section className="delivery-quote" aria-label="پیش‌فاکتور ارسال">
          <h2>خلاصه هزینه</h2>
          <p>جمع کالاها پس از تخفیف: {formatMoney(quote.itemsTotalRials)}</p>
          <p>هزینه ارسال: {formatMoney(quote.shippingRials)}</p>
          <p>مبلغ نهایی: {formatMoney(quote.totalRials)}</p>
          <p>
            این مبلغ تا زمان انقضای پیش‌فاکتور معتبر است و پیش از ثبت سفارش
            دوباره بررسی می‌شود.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void revalidate()}
          >
            بررسی دوباره پیش‌فاکتور
          </button>
          <button
            type="button"
            className="catalog-button"
            disabled={busy}
            onClick={() => void openReview()}
          >
            مشاهده پیش‌فاکتور
          </button>
          <p>ثبت نهایی سفارش در مرحله بعد فراهم می‌شود.</p>
        </section>
      )}
      <p>
        <Link href="/account/addresses">مدیریت و افزودن نشانی</Link>
      </p>
      <p>
        <Link href="/cart">بازگشت به سبد خرید</Link>
      </p>
    </>
  );
}
