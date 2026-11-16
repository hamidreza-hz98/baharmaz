"use client";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";

type Profile = { name: string; mobile: string; birthdate: string | null };
type Step = "closed" | "old" | "new-phone" | "new-code";
export function CustomerAccount() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [step, setStep] = useState<Step>("closed");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  async function load() {
    try {
      const res = await fetch("/api/account", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setLoadError(false);
      setProfile(data.profile);
      setName(data.profile.name);
      setBirthdate(data.profile.birthdate ?? "");
    } catch {
      setLoadError(true);
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/account", { cache: "no-store", signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setProfile(data.profile);
        setName(data.profile.name);
        setBirthdate(data.profile.birthdate ?? "");
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, []);
  async function send(body: object) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "درخواست انجام نشد.");
        return null;
      }
      return data;
    } catch {
      setMessage("ارتباط برقرار نشد. دوباره تلاش کنید.");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function submitProfile(event: React.FormEvent) {
    event.preventDefault();
    const result = await send({
      action: "profile",
      name,
      birthdate: birthdate.trim() || null,
    });
    if (result) {
      setProfile(result.profile);
      setMessage("اطلاعات ذخیره شد.");
    }
  }
  async function begin() {
    const result = await send({ action: "start" });
    if (result) {
      setCode("");
      setMobile("");
      setStep("old");
    }
  }
  async function next(event: React.FormEvent) {
    event.preventDefault();
    const body =
      step === "old"
        ? { action: "verify-old", code }
        : step === "new-phone"
          ? { action: "send-new", mobile }
          : { action: "verify-new", code };
    const result = await send(body);
    if (!result) return;
    setCode("");
    if (step === "old") setStep("new-phone");
    else if (step === "new-phone") setStep("new-code");
    else {
      setProfile(result.profile);
      setStep("closed");
      setMessage("شماره همراه تغییر کرد.");
    }
  }
  if (loadError)
    return (
      <>
        <Typography>دریافت اطلاعات ممکن نشد.</Typography>
        <Button onClick={load}>تلاش دوباره</Button>
      </>
    );
  if (!profile) return <Typography role="status">در حال بارگذاری…</Typography>;
  return (
    <>
      <Typography component="h1" variant="h5">
        اطلاعات شخصی
      </Typography>
      {message && step === "closed" && (
        <Alert severity="info" role="status">
          {message}
        </Alert>
      )}
      <Box
        component="form"
        onSubmit={submitProfile}
        sx={{ display: "grid", gap: 2, maxWidth: 540, mt: 2 }}
      >
        <TextField
          label="نام و نام خانوادگی"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <TextField
          label="تاریخ تولد شمسی"
          value={birthdate}
          onChange={(event) => setBirthdate(event.target.value)}
          placeholder="۱۳۷۰/۰۱/۰۱"
          helperText="اختیاری؛ سال/ماه/روز"
        />
        <Typography>
          شماره همراه: <bdi dir="ltr">{profile.mobile}</bdi>
        </Typography>
        <Box>
          <Button type="button" onClick={begin} disabled={busy}>
            تغییر شماره همراه
          </Button>
          <Button type="submit" variant="contained" disabled={busy}>
            ذخیره تغییرات
          </Button>
        </Box>
      </Box>
      <Dialog
        open={step !== "closed"}
        onClose={() => {
          if (!busy) {
            setStep("closed");
            setMessage("");
          }
        }}
        fullWidth
        maxWidth="xs"
        aria-labelledby="phone-change-title"
      >
        <DialogTitle id="phone-change-title">
          {step === "old"
            ? "تأیید شماره فعلی"
            : step === "new-phone"
              ? "شماره همراه جدید"
              : "تأیید شماره جدید"}
        </DialogTitle>
        <Box component="form" onSubmit={next}>
          <DialogContent sx={{ display: "grid", gap: 2 }}>
            {message && (
              <Alert severity="info" role="status">
                {message}
              </Alert>
            )}
            {step === "old" ? (
              <Typography>کد ارسال‌شده به شماره فعلی را وارد کنید.</Typography>
            ) : step === "new-code" ? (
              <Typography>کد ارسال‌شده به شماره جدید را وارد کنید.</Typography>
            ) : null}
            {step === "new-phone" ? (
              <TextField
                label="شماره همراه جدید"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                required
                autoFocus
              />
            ) : (
              <TextField
                label="کد چهار رقمی"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                slotProps={{
                  htmlInput: {
                    inputMode: "numeric",
                    maxLength: 4,
                    autoComplete: "one-time-code",
                  },
                }}
                required
                autoFocus
              />
            )}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setStep("closed");
                setMessage("");
              }}
              disabled={busy}
            >
              انصراف
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {step === "new-phone" ? "دریافت کد" : "تأیید"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
