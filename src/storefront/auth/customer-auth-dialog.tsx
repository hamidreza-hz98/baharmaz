"use client";
import { useRef, useState } from "react";
import { normalizeDigits } from "@/shared/locale";
import { syncCart } from "@/storefront/cart/client";
import { notifyCustomerChanged } from "./customer-name";
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
  Snackbar,
} from "@mui/material";

type Phase = "phone" | "code" | "registration";
export function CustomerAuthDialog({
  triggerLabel = "ورود / ثبت‌نام",
  disabled = false,
  onAuthenticated,
  open: controlledOpen,
  onClose,
}: {
  triggerLabel?: string;
  disabled?: boolean;
  onAuthenticated?: () => void | Promise<void>;
  open?: boolean;
  onClose?: () => void;
} = {}) {
  const [internalOpen, setOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const [phase, setPhase] = useState<Phase>("phone");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [codeDigits, setCodeDigits] = useState<string[]>([]);
  const codeInputs = useRef<(HTMLInputElement | null)[]>([]);
  const submitting = useRef(false);
  const [developmentCode, setDevelopmentCode] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [signInNotice, setSignInNotice] = useState("ورود با موفقیت انجام شد.");
  function close() {
    if (!busy) {
      setOpen(false);
      onClose?.();
      setPhase("phone");
      setCode("");
      setCodeDigits([]);
      setDevelopmentCode(null);
      setPassword("");
      setConfirmation("");
      setShowPassword(false);
      setShowConfirmation(false);
      setMessage("");
    }
  }
  async function submit(event?: React.FormEvent, completedCode?: string) {
    event?.preventDefault();
    if (submitting.current) return;
    if (phase === "code" && (completedCode ?? code).length !== 4) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    const payload =
      phase === "phone"
        ? { action: "send", mobile }
        : phase === "code"
          ? { action: "verify", mobile, code: completedCode ?? code }
          : { action: "register", firstName, lastName, password, confirmation };
    try {
      const response = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.message || "درخواست انجام نشد.");
        if (phase === "code") {
          setCode("");
          setCodeDigits([]);
        }
        return;
      }
      if (phase === "phone") {
        setCodeDigits([]);
        setCode("");
        setDevelopmentCode(
          typeof result.developmentCode === "string"
            ? result.developmentCode
            : null,
        );
        setPhase("code");
        setMessage("کد تأیید را وارد کنید.");
      } else if (result.next === "registration") {
        setPhase("registration");
        setMessage("");
      } else {
        notifyCustomerChanged();
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
        onClose?.();
        setPhase("phone");
        setCode("");
        setPassword("");
        setConfirmation("");
        setShowPassword(false);
        setShowConfirmation(false);
        setMessage("");
        if (onAuthenticated && (cartSynced || controlledOpen !== undefined))
          await onAuthenticated();
      }
    } catch {
      setMessage("ارتباط برقرار نشد. دوباره تلاش کنید.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {controlledOpen === undefined && (
        <Button
          onClick={() => setOpen(true)}
          variant={onAuthenticated ? "contained" : "outlined"}
          disabled={disabled}
        >
          {triggerLabel}
        </Button>
      )}
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
        <Box
          component="form"
          onSubmit={(event: React.FormEvent) => void submit(event)}
        >
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
                <Box
                  component="fieldset"
                  sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
                >
                  <Box
                    component="legend"
                    sx={{ color: "text.primary", fontSize: "0.875rem", mb: 1 }}
                  >
                    کد تأیید
                  </Box>
                  <Box
                    dir="ltr"
                    sx={{ display: "flex", gap: 1, justifyContent: "center" }}
                  >
                    {Array.from({ length: 4 }, (_, index) => (
                      <TextField
                        key={index}
                        value={codeDigits[index] ?? ""}
                        inputRef={(element: HTMLInputElement | null) => {
                          codeInputs.current[index] = element;
                        }}
                        autoFocus={index === 0}
                        disabled={busy}
                        onChange={(event) => {
                          const value = normalizeDigits(
                            event.target.value,
                          ).replace(/\D/g, "");
                          const next = [...codeDigits];
                          next[index] = value.slice(-1);
                          setCodeDigits(next);
                          setCode(next.join(""));
                          if (
                            Array.from(
                              { length: 4 },
                              (_, i) => next[i] ?? "",
                            ).every((digit) => /^\d$/.test(digit))
                          ) {
                            void submit(undefined, next.join(""));
                          }
                          if (value && index < 3)
                            codeInputs.current[index + 1]?.focus();
                        }}
                        onKeyDown={(event) => {
                          if (
                            event.key === "Backspace" &&
                            !codeDigits[index] &&
                            index > 0
                          )
                            codeInputs.current[index - 1]?.focus();
                          if (event.key === "ArrowLeft" && index > 0)
                            codeInputs.current[index - 1]?.focus();
                          if (event.key === "ArrowRight" && index < 3)
                            codeInputs.current[index + 1]?.focus();
                        }}
                        onPaste={(event) => {
                          event.preventDefault();
                          const digits = normalizeDigits(
                            event.clipboardData.getData("text"),
                          )
                            .replace(/\D/g, "")
                            .slice(0, 4)
                            .split("");
                          if (!digits.length) return;
                          setCodeDigits(digits);
                          setCode(digits.join(""));
                          if (digits.length === 4)
                            void submit(undefined, digits.join(""));
                          codeInputs.current[
                            Math.min(digits.length, 4 - 1)
                          ]?.focus();
                        }}
                        slotProps={{
                          htmlInput: {
                            inputMode: "numeric",
                            maxLength: 1,
                            autoComplete: index === 0 ? "one-time-code" : "off",
                            "aria-label": `رقم ${index + 1} کد تأیید`,
                          },
                        }}
                        sx={{
                          width: 52,
                          maxWidth: "18%",
                          "& .MuiOutlinedInput-root": {
                            borderRadius: 2,
                            backgroundColor: "background.paper",
                          },
                          "& input": {
                            textAlign: "center",
                            fontSize: "1.3rem",
                            fontWeight: 600,
                            padding: "12px 0",
                          },
                        }}
                      />
                    ))}
                  </Box>
                </Box>
                {developmentCode && (
                  <Box
                    component="small"
                    sx={{ color: "text.secondary", fontSize: "0.7rem" }}
                  >
                    کد توسعه: <bdi>{developmentCode}</bdi>
                  </Box>
                )}
                <Button
                  type="button"
                  onClick={() => {
                    setPhase("phone");
                    setCode("");
                    setCodeDigits([]);
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
                  label="نام"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  required
                  autoFocus
                  autoComplete="given-name"
                  slotProps={{ htmlInput: { maxLength: 60 } }}
                />
                <TextField
                  label="نام خانوادگی"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  required
                  autoComplete="family-name"
                  slotProps={{ htmlInput: { maxLength: 60 } }}
                />
                <TextField
                  label="رمز عبور"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  helperText="حداقل ۸ نویسه؛ ورود فعلاً با کد پیامکی انجام می‌شود."
                  autoComplete="new-password"
                  slotProps={{
                    htmlInput: { minLength: 8 },
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button
                            type="button"
                            size="small"
                            aria-label={
                              showPassword
                                ? "پنهان کردن رمز عبور"
                                : "نمایش رمز عبور"
                            }
                            aria-pressed={showPassword}
                            onClick={() => setShowPassword((shown) => !shown)}
                          >
                            {showPassword ? "پنهان" : "نمایش"}
                          </Button>
                        </InputAdornment>
                      ),
                    },
                  }}
                  required
                />
                <TextField
                  label="تکرار رمز عبور"
                  type={showConfirmation ? "text" : "password"}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="new-password"
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <Button
                            type="button"
                            size="small"
                            aria-label={
                              showConfirmation
                                ? "پنهان کردن تکرار رمز عبور"
                                : "نمایش تکرار رمز عبور"
                            }
                            aria-pressed={showConfirmation}
                            onClick={() =>
                              setShowConfirmation((shown) => !shown)
                            }
                          >
                            {showConfirmation ? "پنهان" : "نمایش"}
                          </Button>
                        </InputAdornment>
                      ),
                    },
                  }}
                  required
                />
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={close} disabled={busy}>
              انصراف
            </Button>
            {phase !== "code" && (
              <Button type="submit" variant="contained" disabled={busy}>
                {busy
                  ? "در حال بررسی…"
                  : phase === "phone"
                    ? "دریافت کد"
                    : "تکمیل ثبت‌نام"}
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
