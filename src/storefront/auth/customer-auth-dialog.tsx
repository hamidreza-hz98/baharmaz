"use client";
import { useState } from "react";
import { syncCart } from "@/storefront/cart/client";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Snackbar,
} from "@mui/material";

type Phase = "phone" | "code" | "registration";
export function CustomerAuthDialog({
  triggerLabel = "ورود / ثبت‌نام",
  disabled = false,
  onAuthenticated,
}: {
  triggerLabel?: string;
  disabled?: boolean;
  onAuthenticated?: () => void | Promise<void>;
} = {}) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("phone");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [signInNotice, setSignInNotice] = useState("ورود با موفقیت انجام شد.");
  function close() {
    if (!busy) {
      setOpen(false);
      setPhase("phone");
      setCode("");
      setPassword("");
      setConfirmation("");
      setMessage("");
    }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const payload =
      phase === "phone"
        ? { action: "send", mobile }
        : phase === "code"
          ? { action: "verify", mobile, code }
          : { action: "register", name, password, confirmation };
    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message || "درخواست انجام نشد.");
        return;
      }
      if (phase === "phone") {
        setPhase("code");
        setMessage("کد تأیید را وارد کنید.");
      } else if (result.next === "registration") {
        setPhase("registration");
        setMessage("");
      } else {
        let cartSynced = false;
        try {
          await syncCart();
          cartSynced = true;
          setSignInNotice("ورود با موفقیت انجام شد.");
        } catch {
          setSignInNotice(
            "ورود انجام شد؛ همگام‌سازی سبد انجام نشد. سبد خرید را دوباره باز کنید.",
          );
        }
        setSignedIn(true);
        setOpen(false);
        setPhase("phone");
        setCode("");
        setPassword("");
        setConfirmation("");
        setMessage("");
        if (cartSynced && onAuthenticated) await onAuthenticated();
      }
    } catch {
      setMessage("ارتباط برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant={onAuthenticated ? "contained" : "outlined"}
        disabled={disabled}
      >
        {triggerLabel}
      </Button>
      <Snackbar
        open={signedIn}
        autoHideDuration={5000}
        onClose={() => setSignedIn(false)}
        message={signInNotice}
      />
      <Dialog
        open={open}
        onClose={close}
        fullWidth
        maxWidth="xs"
        aria-labelledby="customer-auth-title"
      >
        <DialogTitle id="customer-auth-title">
          {phase === "phone"
            ? "ورود یا ثبت‌نام"
            : phase === "code"
              ? "تأیید شماره همراه"
              : "تکمیل اطلاعات"}
        </DialogTitle>
        <Box component="form" onSubmit={submit}>
          <DialogContent sx={{ display: "grid", gap: 2 }}>
            {message && (
              <Alert severity="info" role="status">
                {message}
              </Alert>
            )}
            {phase === "phone" && (
              <TextField
                label="شماره همراه"
                value={mobile}
                onChange={(event) => setMobile(event.target.value)}
                autoComplete="tel"
                inputMode="tel"
                required
                autoFocus
              />
            )}
            {phase === "code" && (
              <>
                <TextField
                  label="کد چهار رقمی"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  autoComplete="one-time-code"
                  slotProps={{
                    htmlInput: { inputMode: "numeric", maxLength: 4 },
                  }}
                  required
                  autoFocus
                />
                <Button
                  type="button"
                  onClick={() => {
                    setPhase("phone");
                    setCode("");
                    setMessage("");
                  }}
                >
                  تغییر شماره یا ارسال دوباره
                </Button>
              </>
            )}
            {phase === "registration" && (
              <>
                <TextField
                  label="نام و نام خانوادگی"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  autoFocus
                />
                <TextField
                  label="رمز عبور"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  helperText="حداقل ۱۲ نویسه؛ ورود فعلاً با کد پیامکی انجام می‌شود."
                  autoComplete="new-password"
                  required
                />
                <TextField
                  label="تکرار رمز عبور"
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={close} disabled={busy}>
              انصراف
            </Button>
            <Button type="submit" variant="contained" disabled={busy}>
              {busy
                ? "در حال بررسی…"
                : phase === "phone"
                  ? "دریافت کد"
                  : phase === "code"
                    ? "تأیید"
                    : "تکمیل ثبت‌نام"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
