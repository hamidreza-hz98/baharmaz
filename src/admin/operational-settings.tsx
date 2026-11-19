"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  TextField,
  Typography,
} from "@mui/material";
import type { DeliveryPolicy } from "@/server/delivery/policy";
import { DeliveryZoneMap } from "./delivery-zone-map";

const weekdays = [
  { n: 6, label: "شنبه" },
  { n: 7, label: "یکشنبه" },
  { n: 1, label: "دوشنبه" },
  { n: 2, label: "سه‌شنبه" },
  { n: 3, label: "چهارشنبه" },
  { n: 4, label: "پنجشنبه" },
  { n: 5, label: "جمعه" },
];
const emptyPolicy = (): DeliveryPolicy => ({
  zones: [],
  slots: [],
  closures: [],
  leadMinutes: 120,
  cutoffDaysBefore: 0,
  cutoffTime: "23:59",
  horizonDays: 7,
  quoteTtlSeconds: 600,
});
const newId = () => crypto.randomUUID();

export function OperationalSettings() {
  const [revision, setRevision] = useState(0);
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState<DeliveryPolicy>(emptyPolicy);
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
        setDraft(data.policy ?? emptyPolicy());
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
  function update(next: DeliveryPolicy) {
    setDraft(next);
    setDirty(true);
    setMessage("");
  }
  function reload() {
    setDialog(null);
    setLoading(true);
    setVersion((value) => value + 1);
  }
  async function save(disable = false) {
    if (
      !disable &&
      (!draft.zones.length ||
        !draft.slots.length ||
        draft.zones.some(
          (z) =>
            !z.name.trim() ||
            z.polygon.length < 3 ||
            !Number.isSafeInteger(z.feeRials) ||
            z.feeRials < 0 ||
            z.feeRials % 10 !== 0,
        ) ||
        draft.slots.some(
          (s) =>
            !s.label.trim() ||
            !s.weekdays.length ||
            !s.start ||
            !s.end ||
            s.end <= s.start,
        ))
    ) {
      setError(
        "حداقل یک محدوده با سه نقطه و هزینه معتبر و یک بازه تحویل با روز و ساعت معتبر وارد کنید.",
      );
      return;
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
        body: JSON.stringify({ revision, policy: disable ? null : draft }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "ذخیره قوانین ممکن نشد.");
        setConflict(response.status === 409);
        return;
      }
      setRevision(data.revision);
      setActive(data.active);
      setDraft(data.policy ?? emptyPolicy());
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
    <div className="operational-page">
      <div className="operational-heading">
        <span>
          <SettingsOutlinedIcon aria-hidden="true" />
        </span>
        <div>
          <h1>تنظیمات عملیاتی</h1>
          <p>مدیریت محدوده‌ها، زمان‌بندی و قوانین ارسال فروشگاه</p>
        </div>
      </div>
      <p className="operational-content-link">
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
      <section className="dashboard-panel delivery-settings">
        <div className="operational-section-heading">
          <span>
            <LocalShippingOutlinedIcon aria-hidden="true" />
          </span>
          <div>
            <h2>قوانین ارسال</h2>
            <p>تنظیم هزینه و زمان‌های قابل انتخاب برای مشتریان</p>
          </div>
          <span
            className={`operational-status ${active ? "is-active" : "is-inactive"}`}
          >
            وضعیت: {active ? "فعال" : "غیرفعال"}
          </span>
        </div>
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
          </Alert>
        )}
        <Typography variant="body2">
          برای هر محدوده هزینه را به تومان وارد کنید و گوشه‌های آن را به ترتیب
          روی نقشه انتخاب کنید.
        </Typography>
        <Box
          component="section"
          sx={{ display: "grid", gap: 2, mt: 3 }}
          aria-label="محدوده‌های ارسال"
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1,
            }}
          >
            <Typography
              component="h3"
              variant="h6"
              className="operational-subheading"
            >
              <MapOutlinedIcon aria-hidden="true" />
              محدوده‌های ارسال
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddOutlinedIcon />}
              disabled={busy}
              onClick={() =>
                update({
                  ...draft,
                  zones: [
                    ...draft.zones,
                    { id: newId(), name: "", feeRials: 0, polygon: [] },
                  ],
                })
              }
            >
              افزودن محدوده
            </Button>
          </Box>
          {!draft.zones.length && (
            <Typography color="text.secondary">
              هنوز محدوده‌ای ثبت نشده است.
            </Typography>
          )}
          {draft.zones.map((zone, i) => {
            const setZone = (patch: Partial<DeliveryPolicy["zones"][number]>) =>
              update({
                ...draft,
                zones: draft.zones.map((z, index) =>
                  index === i ? { ...z, ...patch } : z,
                ),
              });
            return (
              <Box key={zone.id} className="delivery-editor-card">
                <Box className="delivery-editor-heading">
                  <strong>
                    محدوده {new Intl.NumberFormat("fa-IR").format(i + 1)}
                  </strong>
                  <Button
                    color="error"
                    startIcon={<DeleteOutlineOutlinedIcon />}
                    disabled={busy}
                    onClick={() =>
                      update({
                        ...draft,
                        zones: draft.zones.filter((_, index) => index !== i),
                      })
                    }
                  >
                    حذف محدوده
                  </Button>
                </Box>
                <Box className="delivery-editor-fields">
                  <TextField
                    label="نام محدوده"
                    value={zone.name}
                    onChange={(e) => setZone({ name: e.target.value })}
                    required
                    fullWidth
                  />
                  <TextField
                    label="هزینه ارسال (تومان)"
                    type="number"
                    value={zone.feeRials / 10}
                    onChange={(e) =>
                      setZone({
                        feeRials:
                          e.target.value === ""
                            ? -1
                            : Number(e.target.value) * 10,
                      })
                    }
                    slotProps={{ htmlInput: { min: 0, step: 1, dir: "ltr" } }}
                    required
                    fullWidth
                  />
                </Box>
                <Typography variant="body2">
                  گوشه‌های محدوده را به ترتیب روی نقشه بزنید؛ حداقل سه نقطه لازم
                  است. نقطه اول و آخر را تکرار نکنید.
                </Typography>
                <DeliveryZoneMap
                  points={zone.polygon}
                  onChange={(polygon) => setZone({ polygon })}
                />
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 1,
                  }}
                >
                  <Typography variant="body2">
                    {new Intl.NumberFormat("fa-IR").format(zone.polygon.length)}{" "}
                    نقطه انتخاب شده
                  </Typography>
                  <Button
                    disabled={!zone.polygon.length || busy}
                    onClick={() =>
                      setZone({ polygon: zone.polygon.slice(0, -1) })
                    }
                  >
                    حذف آخرین نقطه
                  </Button>
                  <Button
                    disabled={!zone.polygon.length || busy}
                    onClick={() => setZone({ polygon: [] })}
                  >
                    پاک کردن محدوده
                  </Button>
                </Box>
              </Box>
            );
          })}
        </Box>
        <Box
          component="section"
          sx={{ display: "grid", gap: 2, mt: 4 }}
          aria-label="بازه‌های تحویل"
        >
          <Box className="delivery-editor-heading">
            <Typography
              component="h3"
              variant="h6"
              className="operational-subheading"
            >
              <ScheduleOutlinedIcon aria-hidden="true" />
              بازه‌های تحویل
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddOutlinedIcon />}
              disabled={busy}
              onClick={() =>
                update({
                  ...draft,
                  slots: [
                    ...draft.slots,
                    {
                      id: newId(),
                      label: "",
                      weekdays: [],
                      start: "09:00",
                      end: "12:00",
                      capacity: null,
                    },
                  ],
                })
              }
            >
              افزودن بازه
            </Button>
          </Box>
          {!draft.slots.length && (
            <Typography color="text.secondary">
              هنوز بازه‌ای ثبت نشده است.
            </Typography>
          )}
          {draft.slots.map((slot, i) => {
            const setSlot = (patch: Partial<DeliveryPolicy["slots"][number]>) =>
              update({
                ...draft,
                slots: draft.slots.map((s, index) =>
                  index === i ? { ...s, ...patch } : s,
                ),
              });
            return (
              <Box key={slot.id} className="delivery-editor-card">
                <Box className="delivery-editor-heading">
                  <strong>
                    بازه {new Intl.NumberFormat("fa-IR").format(i + 1)}
                  </strong>
                  <Button
                    color="error"
                    startIcon={<DeleteOutlineOutlinedIcon />}
                    disabled={busy}
                    onClick={() =>
                      update({
                        ...draft,
                        slots: draft.slots.filter((_, index) => index !== i),
                      })
                    }
                  >
                    حذف بازه
                  </Button>
                </Box>
                <Box className="delivery-editor-fields">
                  <TextField
                    label="عنوان بازه"
                    value={slot.label}
                    onChange={(e) => setSlot({ label: e.target.value })}
                    required
                    fullWidth
                  />
                  <TextField
                    label="از ساعت"
                    type="time"
                    value={slot.start}
                    onChange={(e) => setSlot({ start: e.target.value })}
                    slotProps={{
                      inputLabel: { shrink: true },
                      htmlInput: { dir: "ltr" },
                    }}
                    required
                  />
                  <TextField
                    label="تا ساعت"
                    type="time"
                    value={slot.end}
                    onChange={(e) => setSlot({ end: e.target.value })}
                    slotProps={{
                      inputLabel: { shrink: true },
                      htmlInput: { dir: "ltr" },
                    }}
                    required
                  />
                </Box>
                <Box component="fieldset" className="delivery-weekdays">
                  <legend>روزهای تحویل</legend>
                  {weekdays.map((day) => (
                    <FormControlLabel
                      key={day.n}
                      control={
                        <Checkbox
                          size="small"
                          checked={slot.weekdays.includes(day.n)}
                          onChange={(e) =>
                            setSlot({
                              weekdays: e.target.checked
                                ? [...slot.weekdays, day.n]
                                : slot.weekdays.filter((n) => n !== day.n),
                            })
                          }
                        />
                      }
                      label={day.label}
                    />
                  ))}
                </Box>
                {slot.capacity !== null && (
                  <Alert severity="warning">
                    این بازه ظرفیت عددی دارد و تا راه‌اندازی رزرو ظرفیت برای
                    مشتری قابل انتخاب نیست.{" "}
                    <Button onClick={() => setSlot({ capacity: null })}>
                      بدون محدودیت ظرفیت
                    </Button>
                  </Alert>
                )}
              </Box>
            );
          })}
        </Box>
        <Box
          component="section"
          sx={{ display: "grid", gap: 2, mt: 4 }}
          aria-label="زمان‌بندی سفارش"
        >
          <Typography
            component="h3"
            variant="h6"
            className="operational-subheading"
          >
            <ScheduleOutlinedIcon aria-hidden="true" />
            زمان‌بندی سفارش
          </Typography>
          <Box className="delivery-editor-fields">
            <TextField
              label="زمان آماده‌سازی (دقیقه)"
              type="number"
              value={draft.leadMinutes}
              onChange={(e) =>
                update({
                  ...draft,
                  leadMinutes:
                    e.target.value === "" ? -1 : Number(e.target.value),
                })
              }
              slotProps={{
                htmlInput: { min: 0, max: 43200, step: 1, dir: "ltr" },
              }}
            />
            <TextField
              label="مهلت ثبت سفارش (روز قبل از تحویل)"
              type="number"
              value={draft.cutoffDaysBefore}
              onChange={(e) =>
                update({
                  ...draft,
                  cutoffDaysBefore:
                    e.target.value === "" ? -1 : Number(e.target.value),
                })
              }
              slotProps={{
                htmlInput: { min: 0, max: 30, step: 1, dir: "ltr" },
              }}
            />
            <TextField
              label="ساعت پایان ثبت سفارش"
              type="time"
              value={draft.cutoffTime}
              onChange={(e) => update({ ...draft, cutoffTime: e.target.value })}
              slotProps={{
                inputLabel: { shrink: true },
                htmlInput: { dir: "ltr" },
              }}
            />
            <TextField
              label="نمایش روزهای آینده"
              type="number"
              value={draft.horizonDays}
              onChange={(e) =>
                update({
                  ...draft,
                  horizonDays:
                    e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
              slotProps={{
                htmlInput: { min: 1, max: 90, step: 1, dir: "ltr" },
              }}
            />
            <TextField
              label="اعتبار پیش‌فاکتور (ثانیه)"
              type="number"
              value={draft.quoteTtlSeconds}
              onChange={(e) =>
                update({
                  ...draft,
                  quoteTtlSeconds:
                    e.target.value === "" ? 0 : Number(e.target.value),
                })
              }
              slotProps={{
                htmlInput: { min: 60, max: 86400, step: 1, dir: "ltr" },
              }}
            />
          </Box>
          <Typography variant="body2">
            همه ساعت‌ها به وقت تهران هستند.
          </Typography>
        </Box>
        <Box
          component="section"
          sx={{ display: "grid", gap: 1, mt: 4 }}
          aria-label="روزهای تعطیل"
        >
          <Typography
            component="h3"
            variant="h6"
            className="operational-subheading"
          >
            <EventBusyOutlinedIcon aria-hidden="true" />
            روزهای تعطیل
          </Typography>
          <Typography variant="body2">
            در این تاریخ‌ها ارسال انجام نمی‌شود.
          </Typography>
          {draft.closures.map((date, i) => (
            <Box key={i} sx={{ display: "flex", gap: 1 }}>
              <TextField
                type="date"
                label={`تاریخ تعطیلی ${i + 1}`}
                value={date}
                onChange={(e) =>
                  update({
                    ...draft,
                    closures: draft.closures.map((d, n) =>
                      n === i ? e.target.value : d,
                    ),
                  })
                }
                slotProps={{
                  inputLabel: { shrink: true },
                  htmlInput: { dir: "ltr" },
                }}
              />
              <Button
                color="error"
                startIcon={<DeleteOutlineOutlinedIcon />}
                onClick={() =>
                  update({
                    ...draft,
                    closures: draft.closures.filter((_, n) => n !== i),
                  })
                }
              >
                حذف
              </Button>
            </Box>
          ))}
          <Box>
            <Button
              variant="outlined"
              startIcon={<AddOutlinedIcon />}
              onClick={() =>
                update({ ...draft, closures: [...draft.closures, ""] })
              }
            >
              افزودن تعطیلی
            </Button>
          </Box>
        </Box>
        <div className="content-controls">
          <Button
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            disabled={busy || !dirty}
            onClick={() => void save(false)}
          >
            ذخیره قوانین ارسال
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
      <section className="dashboard-panel operational-security">
        <div className="operational-section-heading">
          <span>
            <SecurityOutlinedIcon aria-hidden="true" />
          </span>
          <div>
            <h2>ارائه‌دهندگان و امنیت</h2>
          </div>
        </div>
        <p>
          تنظیم پیامک، پرداخت و نقشه از پیکربندی سرور انجام می‌شود. کلیدها و
          گذرواژه‌ها در این صفحه نمایش داده نمی‌شوند.
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
            ? "با غیرفعال کردن، انتخاب زمان و محاسبه هزینه ارسال در دسترس نخواهد بود."
            : "با دریافت نسخه جدید، پیش‌نویس ذخیره‌نشده حذف می‌شود."}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>انصراف</Button>
          <Button
            disabled={busy}
            onClick={() => (dialog === "disable" ? void save(true) : reload())}
          >
            {dialog === "disable" ? "تأیید غیرفعال‌سازی" : "دریافت نسخه جدید"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
