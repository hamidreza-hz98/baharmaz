"use client";

import { useEffect, useState } from "react";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import TravelExploreOutlinedIcon from "@mui/icons-material/TravelExploreOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ContactMailOutlinedIcon from "@mui/icons-material/ContactMailOutlined";
import QuizOutlinedIcon from "@mui/icons-material/QuizOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { staticPages, type StaticSeoSettings } from "@/shared/content";
import {
  resolveStaticSeo,
  staticSeoCompleteness,
  staticSeoDefaults,
  type StaticPage,
} from "@/shared/static-seo";

type SeoState = {
  revision: number;
  seo: StaticSeoSettings;
};
const pageNames: Record<StaticPage, string> = {
  home: "خانه",
  contact: "تماس با ما",
  faq: "پرسش‌های متداول",
  terms: "قوانین و شرایط",
  about: "درباره ما",
  products: "محصولات",
};
const pageIcons: Record<StaticPage, React.ReactNode> = {
  home: <HomeOutlinedIcon />,
  contact: <ContactMailOutlinedIcon />,
  faq: <QuizOutlinedIcon />,
  terms: <GavelOutlinedIcon />,
  about: <InfoOutlinedIcon />,
  products: <Inventory2OutlinedIcon />,
};

function SeoPreview({
  page,
  value,
}: {
  page: StaticPage;
  value: StaticSeoSettings[StaticPage];
}) {
  const checked = staticSeoCompleteness(value);
  const preview = resolveStaticSeo(page, value);
  return (
    <section
      className="seo-preview"
      aria-label={`پیش‌نمایش ${pageNames[page]}`}
    >
      <h3>
        <SearchOutlinedIcon aria-hidden="true" /> پیش‌نمایش جست‌وجو و
        اشتراک‌گذاری
      </h3>
      <div className="seo-search-card">
        <p className="seo-preview-path">
          مسیر: <bdi dir="ltr">{staticSeoDefaults[page].path}</bdi>
        </p>
        <strong className="seo-preview-title">{preview.title}</strong>
        <p className="seo-preview-description">{preview.description}</p>
      </div>
      <p>تکمیل تنظیمات: {checked.completed.toLocaleString("fa-IR")} از ۲</p>
      <progress
        max={checked.total}
        value={checked.completed}
        aria-label={`تکمیل تنظیمات ${pageNames[page]}`}
      />
      <ul>
        <li>
          {checked.titleOk
            ? "عنوان تنظیم شده است."
            : value.title.trim()
              ? "عنوان پس از یکسان‌سازی بیش از حد مجاز است."
              : "عنوان را وارد کنید؛ تا آن زمان عنوان پیش‌فرض استفاده می‌شود."}
        </li>
        <li>
          {checked.descriptionOk
            ? "توضیح تنظیم شده است."
            : value.description.trim()
              ? "توضیح پس از یکسان‌سازی بیش از حد مجاز است."
              : "توضیح را وارد کنید؛ تا آن زمان توضیح پیش‌فرض استفاده می‌شود."}
        </li>
      </ul>
      <p className="seo-preview-hint">
        <InfoOutlinedIcon aria-hidden="true" />
        این نشانگر فقط وجود عنوان و توضیح و محدودیت طول آن‌ها را بررسی می‌کند و
        رتبه جست‌وجو را پیش‌بینی نمی‌کند. ظاهر نهایی در سرویس‌ها ممکن است متفاوت
        باشد.
      </p>
    </section>
  );
}

export function SeoSettingsEditor() {
  const [state, setState] = useState<SeoState | null>(null);
  const [draft, setDraft] = useState<StaticSeoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/seo", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<SeoState>;
      })
      .then((data) => {
        setState(data);
        setDraft(data.seo);
        setDirty(false);
        setConflict(false);
        setError("");
        setLoading(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError("دریافت تنظیمات سئو ممکن نشد.");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function edit(
    page: StaticPage,
    field: "title" | "description",
    value: string,
  ) {
    setDraft((current) =>
      current
        ? { ...current, [page]: { ...current[page], [field]: value } }
        : current,
    );
    setDirty(true);
    setMessage("");
  }

  function reload() {
    setConfirmReload(false);
    setLoading(true);
    setError("");
    setRefresh((value) => value + 1);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!state || !draft) return;
    setBusy(true);
    setError("");
    setMessage("");
    setConflict(false);
    try {
      const response = await fetch("/api/admin/seo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: state.revision, seo: draft }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "ذخیره تنظیمات سئو ممکن نشد.");
        setConflict(response.status === 409);
        return;
      }
      setState(result);
      setDraft(result.seo);
      setDirty(false);
      setMessage("تنظیمات سئو ذخیره شد.");
    } catch {
      setError("ارتباط برقرار نشد. تغییرات شما حفظ شده است.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">در حال دریافت تنظیمات سئو…</p>;
  if (!state || !draft)
    return (
      <div role="alert">
        {error || "دریافت تنظیمات سئو ممکن نشد."}{" "}
        <Button onClick={reload}>تلاش دوباره</Button>
      </div>
    );

  return (
    <div className="seo-settings-page">
      <div className="seo-settings-heading">
        <span>
          <TravelExploreOutlinedIcon aria-hidden="true" />
        </span>
        <div>
          <h1>تنظیمات سئو</h1>
          <p>مدیریت عنوان و توضیحات صفحات فروشگاه</p>
        </div>
      </div>
      <p className="seo-settings-notice">
        <InfoOutlinedIcon aria-hidden="true" />
        این صفحه فقط عنوان و توضیحات جست‌وجوی صفحات ثابت را نگه می‌دارد. محتوای
        صفحات در بخش‌های تنظیمات جداگانه مدیریت می‌شود.
      </p>
      {message && (
        <Alert severity="success" role="status">
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" role="alert">
          {error} تغییرات ذخیره‌نشده حفظ شده‌اند.{" "}
          {conflict && (
            <Button type="button" onClick={() => setConfirmReload(true)}>
              دریافت نسخه جدید
            </Button>
          )}
        </Alert>
      )}
      <form onSubmit={save} className="content-settings-form">
        <fieldset disabled={busy} className="seo-settings-section">
          <legend>
            <span className="homepage-settings-legend">
              <span>
                <DescriptionOutlinedIcon aria-hidden="true" />
              </span>{" "}
              عنوان و توضیح صفحات ثابت
            </span>
          </legend>
          {staticPages.map((page) => (
            <div className="content-entry seo-page-entry" key={page}>
              <div className="seo-page-entry-heading">
                <span aria-hidden="true">{pageIcons[page]}</span>
                <div>
                  <h2>{pageNames[page]}</h2>
                  <small>
                    <bdi dir="ltr">{staticSeoDefaults[page].path}</bdi>
                  </small>
                </div>
              </div>
              <label>
                عنوان سئو {pageNames[page]}
                <input
                  maxLength={160}
                  value={draft[page].title}
                  onChange={(event) => edit(page, "title", event.target.value)}
                />
              </label>
              <label>
                توضیحات سئو {pageNames[page]}
                <textarea
                  maxLength={320}
                  value={draft[page].description}
                  onChange={(event) =>
                    edit(page, "description", event.target.value)
                  }
                />
              </label>
              <SeoPreview page={page} value={draft[page]} />
            </div>
          ))}
        </fieldset>
        <Button
          type="submit"
          variant="contained"
          size="small"
          startIcon={<SaveOutlinedIcon />}
          disabled={busy || !dirty}
        >
          {busy ? "در حال ذخیره…" : "ذخیره تنظیمات سئو"}
        </Button>
        {dirty && <span role="status">تغییرات ذخیره نشده است.</span>}
      </form>
      <Dialog
        open={confirmReload}
        onClose={() => setConfirmReload(false)}
        aria-labelledby="seo-reload-title"
      >
        <DialogTitle id="seo-reload-title">دریافت نسخه جدید</DialogTitle>
        <DialogContent>
          با دریافت نسخه جدید، تغییرات ذخیره‌نشده سئو حذف می‌شوند.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmReload(false)}>انصراف</Button>
          <Button onClick={reload}>دریافت نسخه جدید</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
