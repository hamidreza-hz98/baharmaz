"use client";
import { useRef, useState } from "react";
import { Box, TextField } from "@mui/material";
import { normalizeDigits } from "@/shared/locale";

export function OtpInput({
  disabled,
  onComplete,
}: {
  disabled: boolean;
  onComplete: (code: string) => void;
}) {
  const [digits, setDigits] = useState<string[]>([]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  function update(next: string[]) {
    setDigits(next);
    if (
      Array.from({ length: 4 }, (_, index) => next[index] ?? "").every(
        (digit) => /^\d$/.test(digit),
      )
    )
      onComplete(next.join(""));
  }
  return (
    <Box component="fieldset" sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      <Box
        component="legend"
        sx={{ color: "text.primary", fontSize: "0.875rem", mb: 1 }}
      >
        کد تأیید
      </Box>
      <Box dir="ltr" sx={{ display: "flex", gap: 1, justifyContent: "center" }}>
        {Array.from({ length: 4 }, (_, index) => (
          <TextField
            key={index}
            value={digits[index] ?? ""}
            disabled={disabled}
            autoFocus={index === 0}
            inputRef={(element: HTMLInputElement | null) => {
              inputs.current[index] = element;
            }}
            onChange={(event) => {
              const value = normalizeDigits(event.target.value).replace(
                /\D/g,
                "",
              );
              const next = [...digits];
              next[index] = value.slice(-1);
              update(next);
              if (value && index < 3) inputs.current[index + 1]?.focus();
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digits[index] && index > 0)
                inputs.current[index - 1]?.focus();
              if (event.key === "ArrowLeft" && index > 0)
                inputs.current[index - 1]?.focus();
              if (event.key === "ArrowRight" && index < 3)
                inputs.current[index + 1]?.focus();
            }}
            onPaste={(event) => {
              event.preventDefault();
              const next = normalizeDigits(event.clipboardData.getData("text"))
                .replace(/\D/g, "")
                .slice(0, 4)
                .split("");
              if (!next.length) return;
              update(next);
              inputs.current[Math.min(next.length, 3)]?.focus();
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
  );
}
