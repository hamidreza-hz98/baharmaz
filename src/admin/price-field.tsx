"use client";

import { useLayoutEffect, useRef } from "react";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import { formatPersianGroupedInput, normalizeDigits } from "@/shared/locale";

type PriceFieldProps = Omit<
  TextFieldProps,
  "onChange" | "type" | "value" | "inputRef"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

function caretAfterDigitCount(value: string, digitCount: number): number {
  if (digitCount === 0) return 0;
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/[۰-۹]/.test(value[index])) {
      seen += 1;
      if (seen === digitCount)
        return value[index + 1] === "," ? index + 2 : index + 1;
    }
  }
  return value.length;
}

export function PriceField({ value, onValueChange, ...props }: PriceFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const nextCaret = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (nextCaret.current === null) return;
    inputRef.current?.setSelectionRange(nextCaret.current, nextCaret.current);
    nextCaret.current = null;
  }, [value]);

  return (
    <TextField
      {...props}
      type="text"
      value={value}
      inputRef={inputRef}
      onChange={(event) => {
        const raw = event.currentTarget.value;
        const cursor = event.currentTarget.selectionStart ?? raw.length;
        const digitsBeforeCursor = normalizeDigits(raw.slice(0, cursor)).replace(
          /\D/g,
          "",
        ).length;
        const formatted = formatPersianGroupedInput(raw);
        nextCaret.current = caretAfterDigitCount(
          formatted,
          digitsBeforeCursor,
        );
        onValueChange(formatted);
      }}
      slotProps={{ htmlInput: { inputMode: "numeric" } }}
    />
  );
}
