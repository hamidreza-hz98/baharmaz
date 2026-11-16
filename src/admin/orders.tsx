"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  MenuItem,
} from "@mui/material";
import { formatMoney, formatTehranJalali } from "@/shared/locale";
const labels: Record<string, string> = {
  preparing: "در حال آماده‌سازی",
  delivered: "تحویل‌شده",
  cancelled: "لغوشده",
};
type Summary = {
  code: string;
  status: string;
  placedAt: string;
  customerName: string;
  mobile: string;
  totalRials: number | null;
};
type List = { items: Summary[]; total: number; page: number; limit: number };
type Order = {
  code: string;
  status: string;
  placedAt: string;
  customer: { name: string; mobile: string };
  address: {
    recipient: string;
    mobile: string;
    address: string;
    postalCode: string;
  };
  delivery: { date: string; slotLabel: string };
  items: {
    title: string;
    quantity: number;
    unitRials: number;
    lineRials: number;
  }[];
  totals: {
    subtotalRials: number | null;
    discountRials: number | null;
    shippingRials: number | null;
    totalRials: number | null;
    paidRials: number | null;
  };
  payment: {
    status: string;
    transactionReference: string;
    verifiedAt: string | null;
  };
  adminRevision: number;
  adminNote: string;
  history: {
    at: string;
    actor: string;
    previousStatus: string;
    status: string;
    previousNote: string;
    note: string;
  }[];
};
const money = (n: number | null) => (n === null ? "ثبت نشده" : formatMoney(n));
export function OrderManagementList() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<{ data: List | null; error: boolean }>({
    data: null,
    error: false,
  });
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      q: query,
      status,
      page: String(page),
    });
    fetch(`/api/admin/orders?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setState({ data, error: false }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ data: null, error: true });
      });
    return () => controller.abort();
  }, [query, status, page, refresh]);
  function reset() {
    setState({ data: null, error: false });
  }
  return (
    <>
      <div className="dashboard-heading">
        <h1>سفارش‌ها</h1>
        <Button
          component={Link}
          href="/admin/orders/new"
          variant="outlined"
          size="small"
          startIcon={<AddShoppingCartOutlinedIcon />}
        >
          پیش‌نمایش سفارش دستی
        </Button>
      </div>
      <section className="dashboard-panel">
        <div className="customer-filters">
          <TextField
            fullWidth={false}
            sx={{ width: 280, maxWidth: "100%" }}
            size="small"
            label="جست‌وجوی کد، نام یا همراه"
            type="search"
            value={query}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            onChange={(e) => {
              reset();
              setPage(1);
              setQuery(e.target.value);
            }}
          />
          <TextField
            select
            fullWidth={false}
            size="small"
            label="وضعیت"
            value={status}
            onChange={(e) => {
              reset();
              setPage(1);
              setStatus(e.target.value);
            }}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="all">همه</MenuItem>
            {Object.entries(labels).map(([key, value]) => (
              <MenuItem key={key} value={key}>
                {value}
              </MenuItem>
            ))}
          </TextField>
        </div>
        {state.error ? (
          <div role="alert">
            دریافت سفارش‌ها ممکن نشد.{" "}
            <button
              type="button"
              onClick={() => {
                reset();
                setRefresh((n) => n + 1);
              }}
            >
              تلاش دوباره
            </button>
          </div>
        ) : !state.data ? (
          <p role="status">در حال بارگذاری…</p>
        ) : (
          <>
            <p role="status">
              {state.data.total.toLocaleString("fa-IR")} سفارش پیدا شد.
            </p>
            {state.data.items.length ? (
              <div className="dashboard-orders">
                {state.data.items.map((row) => (
                  <article key={row.code}>
                    <Link
                      href={`/admin/orders/${encodeURIComponent(row.code)}`}
                      dir="ltr"
                    >
                      {row.code}
                    </Link>
                    <span>{row.customerName || "نام ثبت نشده"}</span>
                    <bdi>{row.mobile}</bdi>
                    <span>{labels[row.status]}</span>
                    <span>{formatTehranJalali(row.placedAt)}</span>
                    <span>{money(row.totalRials)}</span>
                  </article>
                ))}
              </div>
            ) : (
              <p>سفارشی با این فیلترها پیدا نشد.</p>
            )}
            <div className="dashboard-pagination">
              <Button
                disabled={page === 1}
                onClick={() => {
                  reset();
                  setPage(page - 1);
                }}
              >
                قبلی
              </Button>
              <span>صفحه {page.toLocaleString("fa-IR")}</span>
              <Button
                disabled={page * state.data.limit >= state.data.total}
                onClick={() => {
                  reset();
                  setPage(page + 1);
                }}
              >
                بعدی
              </Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
export function OrderManagementDetail({ code }: { code: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/orders?code=${encodeURIComponent(code)}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setOrder(data.order);
        setStatus(data.order.status);
        setNote(data.order.adminNote);
        setLoading(false);
        setError("");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setError("دریافت سفارش ممکن نشد.");
        }
      });
    return () => controller.abort();
  }, [code, refresh]);
  function reload() {
    setLoading(true);
    setError("");
    setOrder(null);
    setRefresh((n) => n + 1);
  }
  async function save() {
    if (!order) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          revision: order.adminRevision,
          status,
          note,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ذخیره ممکن نشد.");
        return;
      }
      setOrder(data.order);
      setNote(data.order.adminNote);
      setStatus(data.order.status);
      setConfirm(false);
      setMessage("تغییرات ذخیره شد.");
    } catch {
      setError("ارتباط برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">در حال بارگذاری سفارش…</p>;
  if (!order)
    return (
      <div role="alert">
        {error}{" "}
        <button type="button" onClick={reload}>
          تلاش دوباره
        </button>
      </div>
    );
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
      <h1>
        سفارش <bdi>{order.code}</bdi>
      </h1>
      {message && (
        <Alert role="status" severity="success">
          {message}
        </Alert>
      )}
      {error && (
        <Alert role="alert" severity="error">
          {error} <Button onClick={reload}>دریافت اطلاعات تازه</Button>
        </Alert>
      )}
      <div className="dashboard-grid">
        <section className="dashboard-panel">
          <h2>اطلاعات ثبت‌شده سفارش</h2>
          <p>
            مشتری: {order.customer.name} — <bdi>{order.customer.mobile}</bdi>
          </p>
          <p>تاریخ سفارش: {formatTehranJalali(order.placedAt)}</p>
          <p>
            گیرنده: {order.address.recipient} —{" "}
            <bdi>{order.address.mobile}</bdi>
          </p>
          <p>نشانی: {order.address.address}</p>
          <p>
            کد پستی: <bdi>{order.address.postalCode || "ثبت نشده"}</bdi>
          </p>
          <p>
            تحویل: {order.delivery.date || "ثبت نشده"} —{" "}
            {order.delivery.slotLabel || "ثبت نشده"}
          </p>
          <h3>اقلام و قیمت زمان سفارش</h3>
          {order.items.map((item, i) => (
            <p key={`${item.title}-${i}`}>
              {item.title} — {item.quantity.toLocaleString("fa-IR")} عدد ×{" "}
              {money(item.unitRials)} = {money(item.lineRials)}
            </p>
          ))}
          <p>
            جمع کالا: {money(order.totals.subtotalRials)}، تخفیف:{" "}
            {money(order.totals.discountRials)}، ارسال:{" "}
            {money(order.totals.shippingRials)}، کل:{" "}
            {money(order.totals.totalRials)}
          </p>
        </section>
        <section className="dashboard-panel">
          <h2>پرداخت</h2>
          <p>
            وضعیت:{" "}
            {order.payment.status === "verified"
              ? "تأییدشده"
              : order.payment.status === "failed"
                ? "ناموفق"
                : "در انتظار تأیید"}
          </p>
          <p>مبلغ پرداخت‌شده: {money(order.totals.paidRials)}</p>
          <p>
            شناسه تراکنش:{" "}
            <bdi>{order.payment.transactionReference || "ثبت نشده"}</bdi>
          </p>
          <p>
            زمان تأیید:{" "}
            {order.payment.verifiedAt
              ? formatTehranJalali(order.payment.verifiedAt)
              : "ثبت نشده"}
          </p>
          <p>
            تغییر وضعیت سفارش، پرداخت را تغییر نمی‌دهد و بازپرداختی انجام
            نمی‌دهد.
          </p>
        </section>
        <section className="dashboard-panel">
          <h2>تغییر وضعیت و یادداشت داخلی</h2>
          <label>
            وضعیت سفارش{" "}
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(labels)
                .filter(
                  ([key]) =>
                    order.status === "preparing" || key === order.status,
                )
                .map(([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                ))}
            </select>
          </label>
          <TextField
            label="یادداشت داخلی مدیر"
            multiline
            minRows={3}
            fullWidth
            value={note}
            onChange={(e) => setNote(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 1000 } }}
          />
          <p>
            وضعیت تحویل‌شده و لغوشده نهایی است. یادداشت به مشتری نمایش داده
            نمی‌شود.
          </p>
          <Button
            variant="contained"
            disabled={
              busy ||
              (status === order.status && note.trim() === order.adminNote)
            }
            onClick={() => setConfirm(true)}
          >
            بررسی تغییرات
          </Button>
        </section>
        <section className="dashboard-panel">
          <h2>سابقه تغییرات مدیریت</h2>
          {order.history.length ? (
            [...order.history].reverse().map((change, index) => (
              <div key={index} className="order-admin-history">
                <p>{formatTehranJalali(change.at)} — مدیر</p>
                <p>
                  {labels[change.previousStatus]} ← {labels[change.status]}
                </p>
                <p>یادداشت پیشین: {change.previousNote || "خالی"}</p>
                <p>یادداشت جدید: {change.note || "خالی"}</p>
              </div>
            ))
          ) : (
            <p>تغییری ثبت نشده است.</p>
          )}
        </section>
      </div>
      <Dialog
        open={confirm}
        onClose={busy ? undefined : () => setConfirm(false)}
        aria-labelledby="order-confirm-title"
      >
        <DialogTitle id="order-confirm-title">تأیید تغییر سفارش</DialogTitle>
        <DialogContent>
          <p>
            وضعیت: {labels[order.status]} به {labels[status]}
          </p>
          <p>یادداشت جدید: {note.trim() || "خالی"}</p>
          <p>این تغییر، پرداخت یا بازپرداخت را انجام نمی‌دهد.</p>
          {error && (
            <Alert role="alert" severity="error">
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setConfirm(false)}>
            انصراف
          </Button>
          <Button disabled={busy} variant="contained" onClick={save}>
            {busy ? "در حال ذخیره…" : "تأیید و ذخیره"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
