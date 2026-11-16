"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";

export function OperationalSettings() {
  const [revision, setRevision] = useState(0);
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState("");
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [dialog, setDialog] = useState<"reload" | "disable" | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/delivery", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        setRevision(data.revision);
        setActive(data.active);
        setDraft(data.policy ? JSON.stringify(data.policy, null, 2) : "");
        setLoading(false);
        setLoaded(true);
        setDirty(false);
        setError("");
        setConflict(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setError("دریافت قوانین ارسال ممکن نشد.");
        }
      });
    return () => controller.abort();
  }, [version]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  function reload() {
    setDialog(null);
    setLoading(true);
    setVersion((v) => v + 1);
  }
  async function save(disable = false) {
    let policy: unknown = null;
    if (!disable) {
      try {
        policy = JSON.parse(draft);
        if (!policy || typeof policy !== "object" || Array.isArray(policy))
          throw new Error();
      } catch {
        setError("ساختار قوانین باید یک شیء JSON معتبر باشد.");
        return;
      }
    }
    setDialog(null);
    setBusy(true);
    setError("");
    setMessage("");
    setConflict(false);
    try {
      const response = await fetch("/api/admin/delivery", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision, policy }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "ذخیره قوانین ممکن نشد.");
        setConflict(response.status === 409);
        return;
      }
      setRevision(data.revision);
      setActive(data.active);
      setDraft(data.policy ? JSON.stringify(data.policy, null, 2) : "");
      setDirty(false);
      setMessage(data.active ? "قوانین ارسال ذخیره شد." : "ارسال غیرفعال شد.");
    } catch {
      setError("ارتباط برقرار نشد. پیش‌نویس حفظ شده است.");
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <p role="status">در حال دریافت تنظیمات…</p>;
  if (!loaded)
    return (
      <div role="alert">
        {error} <Button onClick={reload}>تلاش دوباره</Button>
      </div>
    );
  return (
    <>
      <h1>تنظیمات عملیاتی</h1>
      <p>
        اطلاعات تماس و شبکه‌های اجتماعی در{" "}
        <Button
          component={Link}
          href="/admin/content"
          size="small"
          startIcon={<ArticleOutlinedIcon />}
        >
          تنظیمات محتوا
        </Button>{" "}
        ویرایش می‌شوند.
      </p>
      <section className="dashboard-panel">
        <h2>قوانین ارسال</h2>
        <p>وضعیت فعلی: {active ? "فعال" : "غیرفعال"}</p>
        <p>
          تا زمانی که محدوده، هزینه و زمان‌های واقعی فروشگاه تأیید نشده‌اند،
          ارسال را غیرفعال نگه دارید. ثبت قوانین جدید قیمت یا بازه فرضی ایجاد
          نمی‌کند.
        </p>
        <p>
          فایل قوانین باید شامل محدوده‌های چندضلعی، هزینه به ریال، بازه‌ها،
          تعطیلی‌ها، زمان آماده‌سازی، مهلت سفارش، افق انتخاب و اعتبار قیمت باشد.
          راهنمای دقیق این ساختار در مستندات عملیاتی پروژه قرار دارد. ظرفیت عددی
          تا زمان پیاده‌سازی رزرو، بازه را ناموجود می‌کند؛ مقدار null به معنی
          ظرفیت نامحدود است.
        </p>
        {message && (
          <Alert severity="success" role="status">
            {message}
          </Alert>
        )}
        {error && (
          <Alert severity="error" role="alert">
            {error}
            {dirty && " پیش‌نویس شما حفظ شده است."}{" "}
            {conflict && (
              <Button onClick={() => setDialog("reload")}>
                دریافت نسخه جدید
              </Button>
            )}
            {!draft && !active && !dirty && (
              <Button onClick={reload}>تلاش دوباره</Button>
            )}
          </Alert>
        )}
        <label className="delivery-policy-label">
          قوانین ارسال (JSON)
          <textarea
            dir="ltr"
            spellCheck={false}
            value={draft}
            disabled={busy}
            onChange={(e) => {
              setDraft(e.target.value);
              setDirty(true);
              setMessage("");
            }}
            aria-describedby="delivery-policy-hint"
          />
        </label>
        <p id="delivery-policy-hint">
          هزینه‌ها عدد صحیح ریال و مضرب ۱۰ هستند؛ تاریخ تعطیلی میلادی و زمان‌ها
          بر اساس تهران هستند.
        </p>
        <div className="content-controls">
          <Button
            variant="contained"
            disabled={busy || !dirty || !draft.trim()}
            onClick={() => save(false)}
          >
            اعتبارسنجی و ذخیره قوانین
          </Button>
          <Button
            disabled={busy || !active}
            onClick={() => setDialog("disable")}
          >
            غیرفعال کردن ارسال
          </Button>
        </div>
        {dirty && <p role="status">تغییرات ذخیره نشده است.</p>}
      </section>
      <section className="dashboard-panel">
        <h2>ارائه‌دهندگان و امنیت</h2>
        <p>
          تنظیم پیامک، پرداخت و نقشه از پیکربندی سرور و طبق مستندات انجام
          می‌شود. کلیدها و گذرواژه‌ها در این صفحه نمایش داده یا ذخیره نمی‌شوند.
          پیامک واقعی و پرداخت درگاهی هنوز آماده بهره‌برداری نیستند.
        </p>
      </section>
      <Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        aria-labelledby="operational-dialog-title"
      >
        <DialogTitle id="operational-dialog-title">
          {dialog === "disable" ? "غیرفعال کردن ارسال" : "دریافت نسخه جدید"}
        </DialogTitle>
        <DialogContent>
          {dialog === "disable"
            ? "با غیرفعال کردن، انتخاب زمان و محاسبه هزینه ارسال در دسترس نخواهد بود. پیش‌نویس ذخیره‌نشده نیز جایگزین می‌شود."
            : "با دریافت نسخه جدید، پیش‌نویس ذخیره‌نشده حذف می‌شود."}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>انصراف</Button>
          <Button
            disabled={busy}
            onClick={() => (dialog === "disable" ? save(true) : reload())}
          >
            {dialog === "disable" ? "تأیید غیرفعال‌سازی" : "دریافت نسخه جدید"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
