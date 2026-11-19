"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import { normalizeDigits } from "@/shared/locale";
import type { AddressItem, Coordinates } from "@/shared/address";
import { AddressMap } from "./address-map";
type MapConfig =
  { enabled: false } | { enabled: true; template: string; attribution: string };
const blank = {
  label: "",
  postalCode: "",
  recipient: "",
  mobile: "",
  address: "",
};
export function AddressBook({
  createOnly = false,
  onClose,
  onCreated,
}: {
  createOnly?: boolean;
  onClose?: () => void;
  onCreated?: (item: AddressItem | null) => void | Promise<void>;
} = {}) {
  const [items, setItems] = useState<AddressItem[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [edit, setEdit] = useState<AddressItem | null | undefined>(
    createOnly ? null : undefined,
  );
  const [form, setForm] = useState(blank);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [removeItem, setRemoveItem] = useState<AddressItem | null>(null);
  const [config, setConfig] = useState<MapConfig>({ enabled: false });
  const [reverse, setReverse] = useState(false);
  async function load() {
    try {
      const response = await fetch("/api/addresses", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setItems((await response.json()).items);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/addresses", { cache: "no-store", signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setItems(data.items))
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    fetch("/api/addresses/map", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setConfig(data.map);
        setReverse(data.reverseEnabled);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  function open(item: AddressItem | null) {
    setEdit(item);
    setForm(
      item
        ? {
            label: item.label,
            postalCode: item.postalCode,
            recipient: item.recipient,
            mobile: item.mobile,
            address: item.address,
          }
        : blank,
    );
    setLat(item?.coordinates ? String(item.coordinates.lat) : "");
    setLng(item?.coordinates ? String(item.coordinates.lng) : "");
    setMessage("");
  }
  function coords(): Coordinates | null {
    const a = normalizeDigits(lat.trim()),
      b = normalizeDigits(lng.trim());
    if (!a && !b) return null;
    if (
      !a ||
      !b ||
      !/^-?\d+(?:\.\d+)?$/.test(a) ||
      !/^-?\d+(?:\.\d+)?$/.test(b)
    )
      throw new Error();
    const p = { lat: Number(a), lng: Number(b) };
    if (
      !Number.isFinite(p.lat) ||
      !Number.isFinite(p.lng) ||
      Math.abs(p.lat) > 90 ||
      Math.abs(p.lng) > 180
    )
      throw new Error();
    return p;
  }
  let point: Coordinates | null = null;
  try {
    point = coords();
  } catch {}
  async function send(action: string, item?: AddressItem) {
    setBusy(true);
    setMessage("");
    try {
      let payload: object;
      if (action === "delete" && item)
        payload = { action, id: item.id, revision: item.revision };
      else
        payload = {
          action,
          ...(edit ? { id: edit.id, revision: edit.revision } : {}),
          address: { ...form, coordinates: coords() },
        };
      const response = await fetch("/api/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "ذخیره ممکن نشد.");
        return;
      }
      setEdit(undefined);
      if (createOnly) {
        await onCreated?.(data.item ?? null);
        onClose?.();
      } else await load();
      setMessage(action === "delete" ? "نشانی حذف شد." : "نشانی ذخیره شد.");
    } catch {
      setMessage("اطلاعات یا مختصات را بررسی کنید و دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }
  async function lookup() {
    let selected: Coordinates | null;
    try {
      selected = coords();
    } catch {
      setMessage("مختصات معتبر وارد کنید.");
      return;
    }
    if (!selected) {
      setMessage("ابتدا مختصات را انتخاب یا وارد کنید.");
      return;
    }
    if (
      form.address &&
      !window.confirm("نشانی فعلی با نتیجه جدید جایگزین شود؟")
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/addresses/reverse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selected),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm((old) => ({ ...old, address: data.address }));
      setMessage("نشانی پیشنهادی را بررسی و ویرایش کنید.");
    } catch (error) {
      setMessage(
        error instanceof Error && error.message
          ? error.message
          : "نشانی‌یابی ممکن نشد؛ دستی وارد کنید.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!createOnly && (
        <>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              gap: 2,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Typography component="h1" variant="h5">
              نشانی‌های من
            </Typography>
            <Button variant="contained" onClick={() => open(null)}>
              افزودن نشانی
            </Button>
          </Box>
          {message && edit === undefined && (
            <Alert sx={{ mt: 2 }} severity="info" role="status">
              {message}
            </Alert>
          )}
          {loadError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              دریافت نشانی‌ها ممکن نشد.{" "}
              <Button onClick={() => void load()}>تلاش دوباره</Button>
            </Alert>
          )}
          {!items && !loadError && <p role="status">در حال دریافت نشانی‌ها…</p>}
          {items?.length === 0 && <p>هنوز نشانی‌ای ثبت نکرده‌اید.</p>}
          <Box sx={{ display: "grid", gap: 2, mt: 2 }}>
            {items?.map((item) => (
              <Box
                key={item.id}
                sx={{
                  p: 2,
                  border: "1px solid #e8ddd6",
                  borderRadius: 2,
                  bgcolor: "white",
                }}
              >
                <strong>{item.label}</strong>
                <p>{item.address}</p>
                <p>
                  {item.recipient} · <bdi dir="ltr">{item.mobile}</bdi>
                </p>
                <Button
                  onClick={() => open(item)}
                  aria-label={`ویرایش ${item.label}`}
                >
                  ویرایش
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => setRemoveItem(item)}
                  aria-label={`حذف ${item.label}`}
                >
                  حذف
                </Button>
              </Box>
            ))}
          </Box>
        </>
      )}
      <Dialog
        open={removeItem !== null}
        onClose={() => {
          if (!busy) setRemoveItem(null);
        }}
        aria-labelledby="address-remove-title"
        aria-describedby="address-remove-description"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="address-remove-title">حذف نشانی</DialogTitle>
        <DialogContent>
          <DialogContentText id="address-remove-description">
            آیا می‌خواهید نشانی «{removeItem?.label}» را حذف کنید؟
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setRemoveItem(null)} disabled={busy} autoFocus>
            انصراف
          </Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => {
              if (!removeItem || busy) return;
              void send("delete", removeItem);
              setRemoveItem(null);
            }}
          >
            حذف نشانی
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={edit !== undefined}
        onClose={() => {
          if (!busy) {
            setEdit(undefined);
            onClose?.();
          }
        }}
        fullWidth
        maxWidth="md"
        aria-labelledby="address-dialog-title"
      >
        <DialogTitle id="address-dialog-title">
          {edit ? "ویرایش نشانی" : "افزودن نشانی"}
        </DialogTitle>
        <DialogContent>
          <Box
            component="form"
            id="address-form"
            onSubmit={(e: React.FormEvent) => {
              e.preventDefault();
              void send(edit ? "update" : "create");
            }}
            sx={{ display: "grid", gap: 2, pt: 1 }}
          >
            {message && (
              <Alert severity="info" role="status">
                {message}
              </Alert>
            )}
            <TextField
              label="عنوان نشانی"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              required
              slotProps={{ htmlInput: { maxLength: 80 } }}
            />
            <TextField
              label="نام گیرنده"
              value={form.recipient}
              onChange={(e) => setForm({ ...form, recipient: e.target.value })}
              required
              slotProps={{ htmlInput: { maxLength: 120 } }}
            />
            <TextField
              label="شماره همراه گیرنده"
              value={form.mobile}
              onChange={(e) => setForm({ ...form, mobile: e.target.value })}
              required
              slotProps={{
                htmlInput: { dir: "ltr", inputMode: "tel", maxLength: 30 },
              }}
            />
            <TextField
              label="کد پستی (اختیاری)"
              value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              slotProps={{
                htmlInput: { dir: "ltr", inputMode: "numeric", maxLength: 10 },
              }}
            />
            <TextField
              label="نشانی کامل"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              multiline
              minRows={3}
              required
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
            <Typography variant="body2">
              موقعیت نشانی را روی نقشه انتخاب کنید.
            </Typography>
            {config.enabled ? (
              <AddressMap
                config={config}
                coordinates={point}
                onChange={(p) => {
                  setLat(String(p.lat));
                  setLng(String(p.lng));
                }}
              />
            ) : (
              <Typography variant="body2">
                نقشه در دسترس نیست؛ مختصات را دستی وارد کنید.
              </Typography>
            )}
            <Box component="details">
              <Box
                component="summary"
                sx={{ cursor: "pointer", color: "primary.main", mb: 1 }}
              >
                ورود دستی مختصات
              </Box>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <TextField
                  label="عرض جغرافیایی"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  slotProps={{
                    htmlInput: { dir: "ltr", inputMode: "decimal" },
                  }}
                />
                <TextField
                  label="طول جغرافیایی"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  slotProps={{
                    htmlInput: { dir: "ltr", inputMode: "decimal" },
                  }}
                />
              </Box>
            </Box>
            {reverse && (
              <Box>
                <Typography variant="body2">
                  برای پیشنهاد نشانی، مختصات انتخاب‌شده به ارائه‌دهنده
                  نشانی‌یابی ارسال می‌شود.
                </Typography>
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void lookup()}
                >
                  پیشنهاد نشانی از مختصات
                </Button>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={busy}
            onClick={() => {
              setEdit(undefined);
              onClose?.();
            }}
          >
            انصراف
          </Button>
          <Button
            disabled={busy}
            type="submit"
            form="address-form"
            variant="contained"
          >
            {busy ? "در حال ذخیره…" : "ذخیره نشانی"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
