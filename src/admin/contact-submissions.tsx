"use client";
import { useEffect, useRef, useState } from "react";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { formatTehranJalali } from "@/shared/locale";
type Message = {
  id: string;
  name: string;
  mobile: string;
  message: string;
  createdAt: string;
};
type Result = { items: Message[]; total: number; page: number; limit: number };
function MessageDialog({ id, close }: { id: string; close: () => void }) {
  const [item, setItem] = useState<Message | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/contact-submissions?id=${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        setItem(data.item);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [id, attempt]);
  return (
    <Dialog
      open
      onClose={close}
      fullWidth
      maxWidth="sm"
      aria-labelledby="contact-detail-title"
    >
      <DialogTitle id="contact-detail-title">جزئیات پیام</DialogTitle>
      <DialogContent>
        {error ? (
          <div role="alert">
            دریافت جزئیات ممکن نشد.{" "}
            <Button
              onClick={() => {
                closeButton.current?.focus();
                setError(false);
                setAttempt((n) => n + 1);
              }}
            >
              تلاش دوباره
            </Button>
          </div>
        ) : !item ? (
          <p role="status">در حال بارگذاری پیام…</p>
        ) : (
          <>
            <p>نام: {item.name}</p>
            <p>
              شماره همراه: <bdi dir="ltr">{item.mobile}</bdi>
            </p>
            <p>تاریخ: {formatTehranJalali(item.createdAt)}</p>
            <p className="contact-message-text">{item.message}</p>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button ref={closeButton} onClick={close}>
          بستن
        </Button>
      </DialogActions>
    </Dialog>
  );
}
export function ContactSubmissions() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: query, page: String(page) });
    fetch(`/api/admin/contact-submissions?${params}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        setResult(data);
        setError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [query, page, attempt]);
  function reset() {
    setResult(null);
    setError(false);
  }
  return (
    <>
      <h1>پیام‌های تماس</h1>
      <p>پیام‌های ثبت‌شده در فرم تماس فروشگاه</p>
      <section className="dashboard-panel">
        <div className="customer-filters">
          <TextField
            fullWidth={false}
            sx={{ width: 280, maxWidth: "100%" }}
            size="small"
            label="جست‌وجوی نام، شماره یا متن"
            type="search"
            value={query}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            onChange={(e) => {
              reset();
              setPage(1);
              setQuery(e.target.value);
            }}
          />
          <Button
            size="small"
            startIcon={<SearchOffOutlinedIcon />}
            onClick={() => {
              if (!query && page === 1) return;
              reset();
              setQuery("");
              setPage(1);
            }}
          >
            پاک‌کردن جست‌وجو
          </Button>
        </div>
        {error ? (
          <div role="alert">
            دریافت پیام‌ها ممکن نشد.{" "}
            <Button
              onClick={() => {
                reset();
                setAttempt((n) => n + 1);
              }}
            >
              تلاش دوباره
            </Button>
          </div>
        ) : !result ? (
          <p role="status">در حال بارگذاری…</p>
        ) : (
          <>
            <p role="status">
              {result.total.toLocaleString("fa-IR")} پیام پیدا شد.
            </p>
            {result.items.length ? (
              <div className="customers-table-wrap">
                <table className="customers-table">
                  <thead>
                    <tr>
                      <th>نام</th>
                      <th>شماره همراه</th>
                      <th>پیام</th>
                      <th>تاریخ</th>
                      <th>عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.items.map((item) => (
                      <tr key={item.id}>
                        <td data-label="نام">{item.name}</td>
                        <td data-label="شماره همراه">
                          <bdi dir="ltr">{item.mobile}</bdi>
                        </td>
                        <td data-label="پیام">
                          <span className="contact-message-excerpt">
                            {item.message}
                          </span>
                        </td>
                        <td data-label="تاریخ">
                          {formatTehranJalali(item.createdAt)}
                        </td>
                        <td data-label="عملیات">
                          <Button
                            onClick={() => setSelected(item.id)}
                            aria-label={`مشاهده پیام ${item.name}`}
                          >
                            مشاهده
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                {query
                  ? "پیامی با این جست‌وجو پیدا نشد."
                  : "هنوز پیامی ثبت نشده است."}
              </p>
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
                disabled={page * result.limit >= result.total}
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
      {selected && (
        <MessageDialog
          key={selected}
          id={selected}
          close={() => setSelected(null)}
        />
      )}
    </>
  );
}
