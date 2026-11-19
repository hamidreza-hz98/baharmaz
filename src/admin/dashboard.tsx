"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import AddShoppingCartOutlinedIcon from "@mui/icons-material/AddShoppingCartOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PermMediaOutlinedIcon from "@mui/icons-material/PermMediaOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import ShoppingBagOutlinedIcon from "@mui/icons-material/ShoppingBagOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { formatMoney, formatTehranJalali } from "@/shared/locale";

type OrderRow = {
  code: string;
  status: string;
  placedAt: string;
  customerName: string;
  totalRials: number;
};
type Orders = { items: OrderRow[]; total: number; page: number; limit: number };
type Metrics = {
  chart: { label: string; amount: number; count: number }[];
  customers: { id: string; name: string; amount: number }[];
  products: { name: string; quantity: number }[];
};
const statuses = [
  ["all", "همه"],
  ["preparing", "در حال آماده‌سازی"],
  ["delivered", "تحویل‌شده"],
  ["cancelled", "لغوشده"],
] as const;
function PanelTitle({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="dashboard-panel-title">
      <span className="dashboard-panel-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </div>
  );
}
function EmptyState({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="dashboard-empty">
      <span aria-hidden="true">{icon}</span>
      <p>{children}</p>
    </div>
  );
}
function useData<T>(url: string) {
  const [state, setState] = useState<{
    data: T | null;
    loading: boolean;
    error: boolean;
  }>({ data: null, loading: true, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { cache: "no-store", signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setState({ data, loading: false, error: false }))
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ data: null, loading: false, error: true });
      });
    return () => controller.abort();
  }, [url, retry]);
  const reload = useCallback(() => {
    setState({ data: null, loading: true, error: false });
    setRetry((n) => n + 1);
  }, []);
  return { ...state, reload };
}
function LoadState({
  loading,
  error,
  reload,
}: {
  loading: boolean;
  error: boolean;
  reload: () => void;
}) {
  if (loading) return <p role="status">در حال بارگذاری…</p>;
  if (error)
    return (
      <div role="alert">
        دریافت اطلاعات ممکن نشد.{" "}
        <button type="button" onClick={reload}>
          تلاش دوباره
        </button>
      </div>
    );
  return null;
}
export function AdminOrders({ all = false }: { all?: boolean }) {
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const url = `/api/admin/dashboard?section=orders&status=${status}&page=${page}${all ? "&all=1" : ""}`;
  return (
    <OrderList
      key={url}
      url={url}
      status={status}
      page={page}
      all={all}
      setPage={setPage}
      setStatus={(value) => {
        setStatus(value);
        setPage(1);
      }}
    />
  );
}
function OrderList({
  url,
  status,
  page,
  all,
  setPage,
  setStatus,
}: {
  url: string;
  status: string;
  page: number;
  all: boolean;
  setPage: (p: number) => void;
  setStatus: (s: string) => void;
}) {
  const state = useData<Orders>(url);
  return (
    <section className="dashboard-panel">
      <div className="dashboard-heading">
        <PanelTitle
          icon={<ReceiptLongOutlinedIcon />}
          title={all ? "سفارش‌ها" : "سفارش‌های اخیر"}
          description={!all ? "آخرین فعالیت‌های فروشگاه در یک نگاه" : undefined}
        />
        {!all && (
          <Button
            component={Link}
            href="/admin/orders"
            size="small"
            endIcon={<ArrowBackIcon />}
          >
            مشاهده همه
          </Button>
        )}
      </div>
      <ToggleButtonGroup
        className="dashboard-tabs"
        size="small"
        exclusive
        value={status}
        aria-label="وضعیت سفارش‌ها"
        onChange={(_, value: string | null) => {
          if (value) setStatus(value);
        }}
      >
        {statuses.map(([value, label]) => (
          <ToggleButton key={value} value={value}>
            {label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <LoadState {...state} />
      {state.data &&
        (state.data.items.length === 0 ? (
          <EmptyState icon={<ReceiptLongOutlinedIcon />}>
            سفارشی در این وضعیت وجود ندارد.
          </EmptyState>
        ) : (
          <div className="dashboard-orders">
            {state.data.items.map((item) => (
              <article key={item.code}>
                <Link
                  href={`/admin/orders/${encodeURIComponent(item.code)}`}
                  dir="ltr"
                >
                  {item.code}
                </Link>
                <span>{item.customerName || "نام ثبت نشده"}</span>
                <span>
                  {statuses.find(([key]) => key === item.status)?.[1] ||
                    "وضعیت نامشخص"}
                </span>
                <span>{formatTehranJalali(item.placedAt)}</span>
                <span>{formatMoney(item.totalRials)}</span>
              </article>
            ))}
          </div>
        ))}
      {all && state.data && (
        <div className="dashboard-pagination">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            صفحه قبل
          </button>
          <span>صفحه {page.toLocaleString("fa-IR")}</span>
          <button
            type="button"
            disabled={page * state.data.limit >= state.data.total}
            onClick={() => setPage(page + 1)}
          >
            صفحه بعد
          </button>
        </div>
      )}
      {!all && (
        <p className="dashboard-footnote">
          <InfoOutlinedIcon aria-hidden="true" /> حداکثر ۱۰ سفارش اخیر در هر
          وضعیت نمایش داده می‌شود.
        </p>
      )}
    </section>
  );
}
function MetricsPanel() {
  const [period, setPeriod] = useState("week");
  return <MetricsContent key={period} period={period} setPeriod={setPeriod} />;
}
function MetricsContent({
  period,
  setPeriod,
}: {
  period: string;
  setPeriod: (value: string) => void;
}) {
  const state = useData<Metrics>(
    `/api/admin/dashboard?section=metrics&period=${period}`,
  );
  const max = Math.max(1, ...(state.data?.chart.map((x) => x.amount) || []));
  return (
    <>
      <section className="dashboard-panel">
        <div className="dashboard-heading">
          <PanelTitle
            icon={<InsightsOutlinedIcon />}
            title="فروش پرداخت‌شده"
            description="پرداخت‌های تأییدشده بر پایه زمان تهران"
          />
          <TextField
            select
            fullWidth={false}
            size="small"
            label="بازه"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            sx={{ minWidth: 100 }}
          >
            <MenuItem value="day">روز</MenuItem>
            <MenuItem value="week">هفته</MenuItem>
            <MenuItem value="month">ماه</MenuItem>
            <MenuItem value="year">سال</MenuItem>
          </TextField>
        </div>
        <p className="dashboard-footnote">
          <InfoOutlinedIcon aria-hidden="true" /> بازپرداخت در داده‌ها ثبت
          نمی‌شود.
        </p>
        <LoadState {...state} />
        {state.data &&
          (state.data.chart.length === 0 ? (
            <EmptyState icon={<InsightsOutlinedIcon />}>
              پرداخت تأییدشده‌ای در این بازه ثبت نشده است.
            </EmptyState>
          ) : (
            <div className="dashboard-chart">
              {state.data.chart.map((point) => (
                <div key={point.label}>
                  <span dir="ltr">{point.label}</span>
                  <div
                    className="dashboard-bar"
                    aria-hidden="true"
                    style={{ width: `${(point.amount / max) * 100}%` }}
                  />
                  <strong>{formatMoney(point.amount)}</strong>
                  <span>({point.count.toLocaleString("fa-IR")} پرداخت)</span>
                </div>
              ))}
            </div>
          ))}
      </section>
      <section className="dashboard-panel">
        <PanelTitle
          icon={<PeopleOutlinedIcon />}
          title="مشتریان برتر"
          description="مجموع پرداخت تأییدشده در همه زمان‌ها"
        />
        <LoadState {...state} />
        {state.data &&
          (state.data.customers.length ? (
            state.data.customers.map((c) => (
              <p className="dashboard-rank" key={c.id}>
                <span>{c.name || "نام ثبت نشده"}</span>
                <strong>{formatMoney(c.amount)}</strong>
              </p>
            ))
          ) : (
            <EmptyState icon={<PeopleOutlinedIcon />}>
              پرداخت تأییدشده‌ای وجود ندارد.
            </EmptyState>
          ))}
      </section>
      <section className="dashboard-panel">
        <PanelTitle
          icon={<ShoppingBagOutlinedIcon />}
          title="پرفروش‌ترین نام‌های ثبت‌شده"
          description="تعداد اقلام در سفارش‌های پرداخت‌شده؛ نام‌های یکسان با هم محاسبه می‌شوند."
        />
        <LoadState {...state} />
        {state.data &&
          (state.data.products.length ? (
            state.data.products.map((p) => (
              <p className="dashboard-rank" key={p.name}>
                <span>{p.name}</span>
                <strong>{p.quantity.toLocaleString("fa-IR")} عدد</strong>
              </p>
            ))
          ) : (
            <EmptyState icon={<ShoppingBagOutlinedIcon />}>
              کالای پرداخت‌شده‌ای وجود ندارد.
            </EmptyState>
          ))}
      </section>
    </>
  );
}
export function Dashboard() {
  return (
    <div className="admin-dashboard">
      <div className="dashboard-heading dashboard-welcome">
        <div className="dashboard-welcome-title">
          <span className="dashboard-welcome-icon">
            <StorefrontOutlinedIcon aria-hidden="true" />
          </span>
          <div>
            <h1>مدیریت فروشگاه</h1>
            <p>نمای کلی فروش و فعالیت‌های بهارمز</p>
          </div>
        </div>
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
      <p className="dashboard-notice">
        <InfoOutlinedIcon aria-hidden="true" /> ایجاد سفارش هنوز در دسترس نیست.
      </p>
      <div className="dashboard-grid">
        <AdminOrders />
        <MetricsPanel />
        <section className="dashboard-panel">
          <PanelTitle
            icon={<BoltOutlinedIcon />}
            title="دسترسی سریع"
            description="کارهای پرکاربرد مدیریت فروشگاه"
          />
          <div className="dashboard-shortcuts">
            <Button
              component={Link}
              href="/admin/products/new"
              variant="outlined"
              size="small"
              startIcon={<Inventory2OutlinedIcon />}
            >
              ایجاد محصول
            </Button>
            <Button
              component={Link}
              href="/admin/media"
              variant="outlined"
              size="small"
              startIcon={<PermMediaOutlinedIcon />}
            >
              رسانه‌ها
            </Button>
            <Button
              component={Link}
              href="/admin/orders"
              variant="outlined"
              size="small"
              startIcon={<ReceiptLongOutlinedIcon />}
            >
              سفارش‌ها
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
