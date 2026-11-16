"use client";
import { useEffect, useState } from "react";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import FilterAltOffOutlinedIcon from "@mui/icons-material/FilterAltOffOutlined";
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
type Row = {
  id: string;
  name: string;
  mobile: string;
  mobileVerified: boolean;
  createdAt: string | null;
  orderCount: number;
  purchaseRials: number;
};
type Data = {
  items: Row[];
  total: number;
  page: number;
  limit: number;
  summary: { customers: number; unverified: number; purchaseRials: number };
};
function CustomerEditor({
  row,
  close,
  saved,
}: {
  row: Row | null;
  close: () => void;
  saved: () => void;
}) {
  const [name, setName] = useState(row?.name ?? "");
  const [mobile, setMobile] = useState(row?.mobile ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          row
            ? {
                action: "update",
                id: row.id,
                name,
                mobile,
                expectedMobile: row.mobile,
              }
            : { action: "create", name, mobile },
        ),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "ذخیره ممکن نشد.");
        return;
      }
      saved();
    } catch {
      setError("ارتباط برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onClose={busy ? undefined : close}
      fullWidth
      maxWidth="xs"
      aria-labelledby="customer-editor-title"
    >
      <DialogTitle id="customer-editor-title">
        {row ? "ویرایش مشتری" : "افزودن مشتری"}
      </DialogTitle>
      <form onSubmit={submit}>
        <DialogContent className="customer-editor-fields">
          <TextField
            label="نام و نام خانوادگی"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            fullWidth
            slotProps={{ htmlInput: { maxLength: 120 } }}
          />
          <TextField
            label="شماره همراه"
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
            fullWidth
            slotProps={{ htmlInput: { dir: "ltr", maxLength: 30 } }}
          />
          <p>
            حساب جدید و شماره تغییرکرده به تأیید پیامکی مشتری نیاز دارد. با
            تغییر شماره، نشست‌های قبلی از اعتبار می‌افتند.
          </p>
          {error && (
            <Alert role="alert" severity="error">
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={close} disabled={busy}>
            انصراف
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            {busy ? "در حال ذخیره…" : "ذخیره مشتری"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
export function AdminCustomers() {
  const [query, setQuery] = useState("");
  const [verification, setVerification] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState<Row | "new" | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      q: query,
      verification,
      page: String(page),
      limit: String(limit),
    });
    fetch(`/api/admin/customers?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((result) => {
        setData(result);
        setLoading(false);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setData(null);
          setLoading(false);
          setError(true);
        }
      });
    return () => controller.abort();
  }, [query, verification, page, limit, revision]);
  function refresh() {
    setLoading(true);
    setError(false);
    setRevision((n) => n + 1);
  }
  function filter(change: () => void) {
    setLoading(true);
    setData(null);
    setPage(1);
    change();
    setRevision((n) => n + 1);
  }
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <h1>مشتریان</h1>
          <p>نمایش و مدیریت حساب‌های مشتریان</p>
        </div>
        <Button
          variant="contained"
          size="small"
          startIcon={<PersonAddAltOutlinedIcon />}
          onClick={() => setEditor("new")}
        >
          افزودن مشتری
        </Button>
      </div>
      <section className="dashboard-panel">
        {loading && <p role="status">در حال بارگذاری…</p>}
        {error && (
          <div role="alert">
            دریافت مشتریان ممکن نشد.{" "}
            <button type="button" onClick={refresh}>
              تلاش دوباره
            </button>
          </div>
        )}
        {data && (
          <div className="customer-summary">
            <div>
              تعداد مشتریان
              <strong>{data.summary.customers.toLocaleString("fa-IR")}</strong>
            </div>
            <div>
              شماره تأییدنشده
              <strong>{data.summary.unverified.toLocaleString("fa-IR")}</strong>
            </div>
            <div>
              مجموع خرید پرداخت‌شده
              <strong>{formatMoney(data.summary.purchaseRials)}</strong>
            </div>
          </div>
        )}
        <div className="customer-filters">
          <TextField
            fullWidth={false}
            sx={{ width: 280, maxWidth: "100%" }}
            size="small"
            label="جست‌وجوی نام یا موبایل"
            type="search"
            value={query}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            onChange={(e) => filter(() => setQuery(e.target.value))}
          />
          <TextField
            select
            fullWidth={false}
            size="small"
            label="وضعیت شماره"
            value={verification}
            onChange={(e) => filter(() => setVerification(e.target.value))}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">همه</MenuItem>
            <MenuItem value="verified">تأییدشده</MenuItem>
            <MenuItem value="unverified">تأییدنشده</MenuItem>
          </TextField>
          <Button
            size="small"
            startIcon={<FilterAltOffOutlinedIcon />}
            onClick={() =>
              filter(() => {
                setQuery("");
                setVerification("all");
              })
            }
          >
            پاک‌کردن فیلتر
          </Button>
        </div>
        {data && (
          <>
            <p role="status">
              {data.total.toLocaleString("fa-IR")} مشتری پیدا شد.
            </p>
            {data.items.length ? (
              <div className="customers-table-wrap">
                <table className="customers-table">
                  <thead>
                    <tr>
                      <th>نام</th>
                      <th>شماره همراه</th>
                      <th>وضعیت شماره</th>
                      <th>تعداد سفارش</th>
                      <th>مجموع خرید پرداخت‌شده</th>
                      <th>تاریخ عضویت</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) => (
                      <tr key={row.id}>
                        <td data-label="نام">{row.name}</td>
                        <td data-label="شماره همراه">
                          <bdi>{row.mobile}</bdi>
                        </td>
                        <td data-label="وضعیت شماره">
                          {row.mobileVerified ? "تأییدشده" : "تأییدنشده"}
                        </td>
                        <td data-label="تعداد سفارش">
                          {row.orderCount.toLocaleString("fa-IR")}
                        </td>
                        <td data-label="مجموع خرید پرداخت‌شده">
                          {formatMoney(row.purchaseRials)}
                        </td>
                        <td data-label="تاریخ عضویت">
                          {row.createdAt
                            ? formatTehranJalali(row.createdAt)
                            : "ثبت نشده"}
                        </td>
                        <td data-label="عملیات">
                          <Button
                            onClick={() => setEditor(row)}
                            aria-label={`ویرایش ${row.name}`}
                          >
                            ویرایش
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>مشتری با این فیلترها پیدا نشد.</p>
            )}
            <div className="dashboard-pagination">
              <label>
                تعداد در صفحه{" "}
                <select
                  value={limit}
                  onChange={(e) =>
                    filter(() => setLimit(Number(e.target.value)))
                  }
                >
                  <option value="5">۵</option>
                  <option value="10">۱۰</option>
                  <option value="20">۲۰</option>
                </select>
              </label>
              <div>
                <Button
                  disabled={page === 1}
                  onClick={() => {
                    setLoading(true);
                    setPage(page - 1);
                  }}
                >
                  قبلی
                </Button>
                <span>صفحه {page.toLocaleString("fa-IR")}</span>
                <Button
                  disabled={page * limit >= data.total}
                  onClick={() => {
                    setLoading(true);
                    setPage(page + 1);
                  }}
                >
                  بعدی
                </Button>
              </div>
            </div>
          </>
        )}
        <p>
          مجموع خرید شامل پرداخت‌های تأییدشده است و بازپرداخت‌ها را کسر نمی‌کند.
        </p>
      </section>
      {editor && (
        <CustomerEditor
          row={editor === "new" ? null : editor}
          close={() => setEditor(null)}
          saved={() => {
            setEditor(null);
            setPage(1);
            refresh();
          }}
        />
      )}
    </>
  );
}
