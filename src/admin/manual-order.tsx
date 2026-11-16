"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { formatMoney } from "@/shared/locale";
type Person = { id: string; name: string; mobile: string };
type Product = {
  id: string;
  title: string;
  priceRials: number;
  discountPriceRials: number | null;
};
type Address = { id: string; label: string; address: string };
type Day = {
  date: string;
  label: string;
  slots: { id: string; label: string; available: boolean }[];
};
type Preview = {
  customer: { name: string };
  delivery: { date: string; slotLabel: string };
  items: {
    productId: string;
    title: string;
    quantity: number;
    lineRials: number;
  }[];
  subtotalRials: number;
  discountRials: number;
  shippingRials: number;
  totalRials: number;
  transfer: string;
};
const reasons: Record<string, string> = {
  not_configured: "قوانین ارسال هنوز تنظیم نشده است.",
  address_missing: "نشانی مشتری پیدا نشد.",
  customer_missing: "مشتری پیدا نشد.",
  coordinates_required: "نشانی باید موقعیت مکانی داشته باشد.",
  outside: "نشانی خارج از محدوده ارسال است.",
  ambiguous: "محدوده ارسال هم‌پوشانی دارد.",
  slot_unavailable: "زمان ارسال در دسترس نیست.",
  product_unavailable: "یکی از محصولات در دسترس نیست.",
  too_many_addresses: "تعداد نشانی‌ها بیش از حد مجاز است.",
};
export function ManualOrder() {
  const [customerQuery, setCustomerQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState<
    { productId: string; title: string; quantity: number }[]
  >([]);
  const [days, setDays] = useState<Day[]>([]);
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [transfer, setTransfer] = useState("unreported");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(
      `/api/admin/customers?q=${encodeURIComponent(customerQuery)}&limit=20`,
      { signal: ctrl.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setPeople(d.items))
      .catch(() => {
        if (!ctrl.signal.aborted) setError("دریافت مشتریان ممکن نشد.");
      });
    return () => ctrl.abort();
  }, [customerQuery]);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(
      `/api/admin/products?q=${encodeURIComponent(productQuery)}&availability=available&limit=20`,
      { signal: ctrl.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setProducts(d.items))
      .catch(() => {
        if (!ctrl.signal.aborted) setError("دریافت محصولات ممکن نشد.");
      });
    return () => ctrl.abort();
  }, [productQuery]);
  useEffect(() => {
    if (!customerId) return;
    const ctrl = new AbortController();
    fetch(
      `/api/admin/manual-order?customer=${encodeURIComponent(customerId)}`,
      { signal: ctrl.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setAddresses(d.items))
      .catch(() => {
        if (!ctrl.signal.aborted) setError("دریافت نشانی‌ها ممکن نشد.");
      });
    return () => ctrl.abort();
  }, [customerId]);
  async function send(body: object) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/manual-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          reasons[result.reason] || result.error || "درخواست انجام نشد.",
        );
        return null;
      }
      return result;
    } catch {
      setError("ارتباط برقرار نشد. دوباره تلاش کنید.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function loadOptions() {
    setDays([]);
    setDate("");
    setSlotId("");
    setPreview(null);
    const result = await send({ action: "options", customerId, addressId });
    if (result) {
      setDays(result.days);
      setDate("");
      setSlotId("");
      setPreview(null);
    }
  }
  async function calculate(event: React.FormEvent) {
    event.preventDefault();
    setPreview(null);
    const result = await send({
      action: "preview",
      customerId,
      addressId,
      date,
      slotId,
      items: items.map(({ productId, quantity }) => ({ productId, quantity })),
      transfer,
    });
    if (result) setPreview(result);
  }
  return (
    <>
      <Button
        component={Link}
        href="/admin/orders"
        variant="outlined"
        size="small"
        startIcon={<ArrowBackIcon />}
      >
        بازگشت به سفارش‌ها
      </Button>
      <h1>پیش‌نویس سفارش دستی</h1>
      <p>این صفحه فقط پیش‌نمایش است؛ ثبت سفارش هنوز در دسترس نیست.</p>
      {error && <p role="alert">{error}</p>}
      <form onSubmit={calculate} className="dashboard-panel manual-order-form">
        <fieldset disabled={busy}>
          <legend>انتخاب مشتری و نشانی</legend>
          <label>
            جست‌وجوی مشتری
            <input
              type="search"
              value={customerQuery}
              onChange={(e) => {
                setCustomerQuery(e.target.value);
                setCustomerId("");
                setAddressId("");
                setAddresses([]);
                setDays([]);
                setDate("");
                setSlotId("");
                setPreview(null);
              }}
              maxLength={120}
            />
          </label>
          <label>
            مشتری
            <select
              required
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setAddressId("");
                setAddresses([]);
                setDays([]);
                setDate("");
                setSlotId("");
                setPreview(null);
              }}
            >
              <option value="">انتخاب مشتری</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.mobile}
                </option>
              ))}
            </select>
          </label>
          <label>
            نشانی
            <select
              required
              value={addressId}
              onChange={(e) => {
                setAddressId(e.target.value);
                setDays([]);
                setDate("");
                setSlotId("");
                setPreview(null);
              }}
            >
              <option value="">انتخاب نشانی</option>
              {addresses.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label} — {a.address}
                </option>
              ))}
            </select>
          </label>
          {customerId && !addresses.length && (
            <p>برای این مشتری نشانی موجودی نمایش داده نمی‌شود.</p>
          )}
          <button type="button" disabled={!addressId} onClick={loadOptions}>
            دریافت زمان‌های ارسال
          </button>
        </fieldset>
        <fieldset disabled={busy}>
          <legend>محصولات</legend>
          <label>
            جست‌وجوی محصول
            <input
              type="search"
              value={productQuery}
              onChange={(e) => {
                setProductQuery(e.target.value);
                setProductId("");
              }}
              maxLength={80}
            />
          </label>
          <label>
            محصول
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
            >
              <option value="">انتخاب محصول</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} —{" "}
                  {formatMoney(p.discountPriceRials ?? p.priceRials)}
                </option>
              ))}
            </select>
          </label>
          <label>
            تعداد
            <input
              type="number"
              min="1"
              max="99"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            disabled={
              !productId ||
              !Number.isInteger(quantity) ||
              quantity < 1 ||
              quantity > 99
            }
            onClick={() => {
              const p = products.find((x) => x.id === productId);
              if (!p) return;
              setItems((current) => [
                ...current.filter((x) => x.productId !== p.id),
                { productId: p.id, title: p.title, quantity },
              ]);
              setPreview(null);
            }}
          >
            افزودن یا ویرایش محصول
          </button>
          {items.length ? (
            items.map((item) => (
              <p key={item.productId}>
                {item.title} — {item.quantity.toLocaleString("fa-IR")} عدد{" "}
                <button
                  type="button"
                  onClick={() => {
                    setItems((current) =>
                      current.filter((x) => x.productId !== item.productId),
                    );
                    setPreview(null);
                  }}
                >
                  حذف {item.title}
                </button>
              </p>
            ))
          ) : (
            <p>محصولی انتخاب نشده است.</p>
          )}
        </fieldset>
        <fieldset disabled={busy}>
          <legend>تحویل و انتقال بانکی</legend>
          <label>
            تاریخ ارسال
            <select
              required
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setSlotId("");
                setPreview(null);
              }}
            >
              <option value="">انتخاب تاریخ</option>
              {days.map((day) => (
                <option key={day.date} value={day.date}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            بازه ارسال
            <select
              required
              value={slotId}
              onChange={(e) => {
                setSlotId(e.target.value);
                setPreview(null);
              }}
            >
              <option value="">انتخاب بازه</option>
              {days
                .find((day) => day.date === date)
                ?.slots.map((slot) => (
                  <option
                    key={slot.id}
                    value={slot.id}
                    disabled={!slot.available}
                  >
                    {slot.label}
                    {slot.available ? "" : " — ناموجود"}
                  </option>
                ))}
            </select>
          </label>
          <label>
            وضعیت کارت به کارت
            <select
              value={transfer}
              onChange={(e) => {
                setTransfer(e.target.value);
                setPreview(null);
              }}
            >
              <option value="unreported">انتقال گزارش نشده</option>
              <option value="reported">انتقال گزارش شده</option>
              <option value="admin_confirmed">انتقال تأییدشده توسط مدیر</option>
            </select>
          </label>
          <p>
            تأیید مدیر یک اظهار دستی است و تأیید درگاه پرداخت محسوب نمی‌شود.
          </p>
          <button type="submit" disabled={!items.length || !slotId}>
            {busy ? "در حال محاسبه…" : "محاسبه پیش‌نمایش"}
          </button>
        </fieldset>
      </form>
      {preview && (
        <section className="dashboard-panel" aria-live="polite">
          <h2>پیش‌نمایش محاسبه‌شده</h2>
          <p>
            {preview.customer.name} — {preview.delivery.date}،{" "}
            {preview.delivery.slotLabel}
          </p>
          <p>
            کارت به کارت:{" "}
            {preview.transfer === "admin_confirmed"
              ? "تأییدشده توسط مدیر (اظهار دستی)"
              : preview.transfer === "reported"
                ? "انتقال گزارش شده"
                : "انتقال گزارش نشده"}
          </p>
          {preview.items.map((item) => (
            <p key={item.productId}>
              {item.title} — {item.quantity.toLocaleString("fa-IR")} عدد —{" "}
              {formatMoney(item.lineRials)}
            </p>
          ))}
          <p>
            جمع کالا: {formatMoney(preview.subtotalRials)}، تخفیف:{" "}
            {formatMoney(preview.discountRials)}، ارسال:{" "}
            {formatMoney(preview.shippingRials)}، مجموع:{" "}
            {formatMoney(preview.totalRials)}
          </p>
          <p>این مبلغ و زمان هنگام ثبت نهایی باید دوباره بررسی شوند.</p>
          <button type="button" disabled>
            ثبت سفارش در دسترس نیست
          </button>
        </section>
      )}
    </>
  );
}
