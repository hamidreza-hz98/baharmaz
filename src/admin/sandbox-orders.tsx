"use client";
import { useEffect, useState } from "react";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { formatMoney, formatTehranJalali } from "@/shared/locale";
type Row = {
  code: string;
  state: string;
  createdAt: string;
  snapshot: {
    customer: { name: string; mobile: string };
    address: { label: string; recipient: string; address: string };
    delivery: { date: string; slot: { label: string }; totalRials: number };
    items: { title: string; quantity: number; lineRials: number }[];
  };
};
export function SandboxAdminOrders() {
  const [items, setItems] = useState<Row[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/sandbox-orders", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.items)
          setItems(data.items.filter((item: Row) => item.state !== "verified"));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  if (!items.length) return null;
  return (
    <section
      className="dashboard-panel sandbox-attempts-panel"
      aria-labelledby="admin-sandbox-orders"
    >
      <div className="orders-list-heading">
        <span className="orders-section-icon is-sandbox">
          <ScienceOutlinedIcon aria-hidden="true" />
        </span>
        <div>
          <h2 id="admin-sandbox-orders">
            پرداخت‌های آزمایشی ناموفق یا در حال بررسی
          </h2>
          <p>پیگیری پرداخت‌های آزمایشی تکمیل‌نشده</p>
        </div>
      </div>
      <p className="sandbox-attempts-note">
        <InfoOutlinedIcon aria-hidden="true" />
        این سفارش‌ها درگاه آزمایشی هستند، برای ارسال ثبت نمی‌شوند و در فروش
        واقعی محاسبه نمی‌شوند. حداکثر ۵۰ سفارش اخیر نمایش داده می‌شود.
      </p>
      {items.map((row) => (
        <details key={row.code} className="admin-sandbox-order">
          <summary>
            <strong>
              <bdi dir="ltr">{row.code}</bdi>
            </strong>
            <span
              className={`admin-order-status ${row.state === "failed" ? "is-cancelled" : "is-preparing"}`}
            >
              {row.state === "failed"
                ? "پرداخت آزمایشی ناموفق"
                : "در حال بررسی"}
            </span>
            <span>{formatMoney(row.snapshot.delivery.totalRials)}</span>
          </summary>
          <p>
            {row.snapshot.customer.name} ·{" "}
            <bdi dir="ltr">{row.snapshot.customer.mobile}</bdi>
          </p>
          <p>
            {row.snapshot.address.label}: {row.snapshot.address.address}
          </p>
          <p>گیرنده: {row.snapshot.address.recipient}</p>
          <p>
            تحویل: <bdi dir="ltr">{row.snapshot.delivery.date}</bdi> ·{" "}
            {row.snapshot.delivery.slot.label}
          </p>
          <ul>
            {row.snapshot.items.map((item, i) => (
              <li key={i}>
                {item.title} ×{" "}
                {new Intl.NumberFormat("fa-IR").format(item.quantity)} —{" "}
                {formatMoney(item.lineRials)}
              </li>
            ))}
          </ul>
          <p>{formatTehranJalali(row.createdAt)}</p>
        </details>
      ))}
    </section>
  );
}
