"use client";
import { useEffect, useRef, useState } from "react";
import { notifyCustomerChanged } from "@/storefront/auth/customer-name";
import { OtpInput } from "@/storefront/auth/otp-input";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFnsJalali } from "@mui/x-date-pickers/AdapterDateFnsJalali";
import { faIR } from "@mui/x-date-pickers/locales";
import { format, isValid, parse, subDays } from "date-fns-jalali";
import { normalizeDigits } from "@/shared/locale";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";

type Profile = {
  firstName: string;
  lastName: string;
  mobile: string;
  birthdate: string | null;
};
type Step = "closed" | "old" | "new-phone" | "new-code";
function parseBirthdate(value: string | null): Date | null {
  if (!value) return null;
  const date = parse(normalizeDigits(value), "yyyy/MM/dd", new Date());
  return isValid(date) ? date : null;
}
export function CustomerAccount() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [birthdateError, setBirthdateError] = useState(false);
  const [step, setStep] = useState<Step>("closed");
  const [mobile, setMobile] = useState("");
  const [developmentCode, setDevelopmentCode] = useState<string | null>(null);
  const [otpAttempt, setOtpAttempt] = useState(0);
  const submittingOtp = useRef(false);
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
      setFirstName(data.profile.firstName);
      setLastName(data.profile.lastName);
      setBirthdate(parseBirthdate(data.profile.birthdate));
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
        setFirstName(data.profile.firstName);
        setLastName(data.profile.lastName);
        setBirthdate(parseBirthdate(data.profile.birthdate));
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
    if (birthdateError || (birthdate && !isValid(birthdate))) return;
    const result = await send({
      action: "profile",
      firstName,
      lastName,
      birthdate: birthdate ? format(birthdate, "yyyy/MM/dd") : null,
    });
    if (result) {
      setProfile(result.profile);
      notifyCustomerChanged();
      setMessage("اطلاعات ذخیره شد.");
    }
  }
  async function begin() {
    const result = await send({ action: "start" });
    if (result) {
      setDevelopmentCode(
        typeof result.developmentCode === "string"
          ? result.developmentCode
          : null,
      );
      setOtpAttempt((value) => value + 1);
      setMobile("");
      setStep("old");
    }
  }
  async function next(completedCode?: string) {
    if (submittingOtp.current || busy) return;
    if (step !== "new-phone" && !/^\d{4}$/.test(completedCode ?? "")) return;
    submittingOtp.current = true;
    const body =
      step === "old"
        ? { action: "verify-old", code: completedCode }
        : step === "new-phone"
          ? { action: "send-new", mobile }
          : { action: "verify-new", code: completedCode };
    const result = await send(body);
    submittingOtp.current = false;
    if (!result) {
      if (step !== "new-phone") setOtpAttempt((value) => value + 1);
      return;
    }
    if (step === "old") {
      setDevelopmentCode(null);
      setStep("new-phone");
    } else if (step === "new-phone") {
      setDevelopmentCode(
        typeof result.developmentCode === "string"
          ? result.developmentCode
          : null,
      );
      setStep("new-code");
    } else {
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
          label="نام"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          autoComplete="given-name"
          slotProps={{ htmlInput: { maxLength: 60 } }}
          required
        />
        <TextField
          label="نام خانوادگی"
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          autoComplete="family-name"
          slotProps={{ htmlInput: { maxLength: 60 } }}
          required
        />
        <LocalizationProvider
          dateAdapter={AdapterDateFnsJalali}
          localeText={
            faIR.components.MuiLocalizationProvider.defaultProps.localeText
          }
        >
          <DatePicker
            label="تاریخ تولد شمسی"
            value={birthdate}
            onChange={(value) => setBirthdate(value)}
            onError={(error) => setBirthdateError(error !== null)}
            format="yyyy/MM/dd"
            views={["year", "month", "day"]}
            openTo="year"
            minDate={parse("1200/01/01", "yyyy/MM/dd", new Date())}
            maxDate={subDays(parse("1601/01/01", "yyyy/MM/dd", new Date()), 1)}
            slotProps={{
              field: { clearable: true },
              textField: {
                fullWidth: true,
                size: "small",
                helperText: birthdateError
                  ? "تاریخ معتبر وارد کنید."
                  : "اختیاری؛ سال/ماه/روز",
              },
            }}
          />
        </LocalizationProvider>
        <TextField
          label="شماره همراه"
          value={profile.mobile}
          slotProps={{
            htmlInput: { readOnly: true, dir: "ltr" },
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <Button
                    type="button"
                    onClick={begin}
                    disabled={busy}
                    aria-label="تغییر شماره همراه"
                  >
                    تغییر
                  </Button>
                </InputAdornment>
              ),
            },
          }}
        />
        <Box>
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
        <Box
          component="form"
          onSubmit={(event: React.FormEvent) => {
            event.preventDefault();
            if (step === "new-phone") void next();
          }}
        >
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
              <>
                <OtpInput
                  key={`${step}-${otpAttempt}`}
                  disabled={busy}
                  onComplete={(value) => void next(value)}
                />
                {developmentCode && (
                  <Box
                    component="small"
                    sx={{ color: "text.secondary", fontSize: "0.7rem" }}
                  >
                    کد توسعه: <bdi>{developmentCode}</bdi>
                  </Box>
                )}
              </>
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
            {step === "new-phone" && (
              <Button type="submit" variant="contained" disabled={busy}>
                دریافت کد
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
