import { Temporal } from "@js-temporal/polyfill";
import { isValidJalaaliDate, toGregorian, toJalaali } from "jalaali-js";

/** Convert Persian and Arabic-Indic digits without changing other characters. */
export function normalizeDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => {
    const code = digit.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** Format integer input with Persian digits and an ASCII comma every three digits. */
export function formatPersianGroupedInput(value: string): string {
  const digits = normalizeDigits(value).replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.replace(/^0+(?=\d)/, "");
  return normalized
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    .replace(/\d/g, (digit) => String.fromCharCode(0x06f0 + Number(digit)));
}

/** Parse an integer that may contain Persian/Arabic digits and common group separators. */
export function parseLocalizedInteger(value: string): number {
  const digits = normalizeDigits(value.trim()).replace(/[\s,٬،]/g, "");
  if (!/^\d+$/.test(digits)) throw new RangeError("Expected a whole number.");
  const amount = Number(digits);
  if (!Number.isSafeInteger(amount)) throw new RangeError("Number is too large.");
  return amount;
}

/** Canonical Iranian mobile is 09 followed by nine digits; formatting is discarded. */
export function normalizeIranianMobile(input: string): string {
  const text = normalizeDigits(input.trim());
  if (!/^\+?[\d\s()-]+$/.test(text))
    throw new RangeError("Invalid Iranian mobile number.");
  const compact = text.replace(/[\s()-]/g, "");
  const local = compact.startsWith("+98")
    ? `0${compact.slice(3)}`
    : compact.startsWith("0098")
      ? `0${compact.slice(4)}`
      : compact.startsWith("98")
        ? `0${compact.slice(2)}`
        : compact;
  if (!/^09\d{9}$/.test(local))
    throw new RangeError("Invalid Iranian mobile number.");
  return local;
}

export type JalaliDate = { year: number; month: number; day: number };
const tehranZone = "Asia/Tehran";
const faInteger = new Intl.NumberFormat("fa-IR", { useGrouping: false });
function validateJalali(date: JalaliDate): void {
  if (
    ![date.year, date.month, date.day].every(Number.isInteger) ||
    date.year < 1200 ||
    date.year > 1600 ||
    !isValidJalaaliDate(date.year, date.month, date.day)
  )
    throw new RangeError("Invalid or unsupported Jalali date.");
}
/** Parse a civil date, without treating it as a UTC timestamp. */
export function parseJalaliDate(input: string): JalaliDate {
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(
    normalizeDigits(input.trim()),
  );
  if (!match) throw new RangeError("Invalid Jalali date format.");
  const date = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
  validateJalali(date);
  return date;
}
/** Convert a Tehran wall time to a UTC instant. Ambiguous and skipped local times are rejected. */
export function tehranInstantFromJalali(
  date: JalaliDate,
  hour = 0,
  minute = 0,
): string {
  validateJalali(date);
  if (
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(minute) ||
    minute < 0 ||
    minute > 59
  )
    throw new RangeError("Invalid local time.");
  const { gy, gm, gd } = toGregorian(date.year, date.month, date.day);
  return Temporal.ZonedDateTime.from(
    { timeZone: tehranZone, year: gy, month: gm, day: gd, hour, minute },
    { disambiguation: "reject", overflow: "reject" },
  )
    .toInstant()
    .toString();
}
/** Render an offset-bearing instant as a Jalali date and Tehran time. */
export function formatTehranJalali(instant: string): string {
  const zoned = Temporal.Instant.from(instant).toZonedDateTimeISO(tehranZone);
  const { jy, jm, jd } = toJalaali(zoned.year, zoned.month, zoned.day);
  validateJalali({ year: jy, month: jm, day: jd });
  const time =
    `${String(zoned.hour).padStart(2, "0")}:${String(zoned.minute).padStart(2, "0")}`.replace(
      /\d/g,
      (digit) => faInteger.format(Number(digit)),
    );
  return `${faInteger.format(jy)}/${faInteger.format(jm)}/${faInteger.format(jd)}، ${time}`;
}

function wholeNonNegative(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(`${name} must be a non-negative safe integer.`);
}
function safeNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RangeError("Money calculation exceeds the safe integer range.");
  return Number(value);
}
/** Amounts are integer rials. Use server-side values for all authoritative calculations. */
export function sumRials(amounts: readonly number[]): number {
  return safeNumber(
    amounts.reduce((total, amount) => {
      wholeNonNegative(amount, "Amount");
      return total + BigInt(amount);
    }, BigInt(0)),
  );
}
export function multiplyRials(amount: number, quantity: number): number {
  wholeNonNegative(amount, "Amount");
  wholeNonNegative(quantity, "Quantity");
  return safeNumber(BigInt(amount) * BigInt(quantity));
}
/** Basis points: 10,000 = 100%. Half-rial ties round upward. */
export function discountRials(amount: number, basisPoints: number): number {
  wholeNonNegative(amount, "Amount");
  wholeNonNegative(basisPoints, "Basis points");
  if (basisPoints > 10000) throw new RangeError("Discount cannot exceed 100%.");
  return safeNumber(
    (BigInt(amount) * BigInt(basisPoints) + BigInt(5000)) / BigInt(10000),
  );
}
export function tomansToRials(tomans: number): number {
  wholeNonNegative(tomans, "Tomans");
  return safeNumber(BigInt(tomans) * BigInt(10));
}
export function rialsToTomans(rials: number): number {
  wholeNonNegative(rials, "Rials");
  if (rials % 10 !== 0)
    throw new RangeError(
      "Rials must be divisible by 10 to display whole tomans.",
    );
  return rials / 10;
}
export function formatMoney(
  rials: number,
  unit: "rial" | "toman" = "toman",
): string {
  const amount = unit === "toman" ? rialsToTomans(rials) : rials;
  wholeNonNegative(amount, "Amount");
  if (unit !== "rial" && unit !== "toman")
    throw new RangeError("Unknown money unit.");
  const formatted = new Intl.NumberFormat("fa-IR")
    .format(amount)
    .replace(/\u066c/g, ",");
  return `${formatted} ${unit === "toman" ? "تومان" : "ریال"}`;
}

/** Output is a Unicode slug, not an HTML fragment; encode it when constructing URLs. */
export function makeSlug(input: string): string {
  if (input.length > 500) throw new RangeError("Slug input is too long.");
  const slug = normalizeDigits(input.normalize("NFKC"))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u064b-\u065f\u0670]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  const result = Array.from(slug).slice(0, 80).join("").replace(/-+$/g, "");
  if (!result) throw new RangeError("Slug must contain letters or digits.");
  return result;
}

export function parsePagination(
  pageInput?: string,
  limitInput?: string,
): { page: number; limit: number; skip: number } {
  function parse(
    value: string | undefined,
    fallback: number,
    max: number,
  ): number {
    if (value === undefined) return fallback;
    const normalized = normalizeDigits(value);
    if (!/^[0-9]+$/.test(normalized))
      throw new RangeError("Pagination must contain positive integers.");
    const number = Number(normalized);
    if (!Number.isSafeInteger(number) || number < 1 || number > max)
      throw new RangeError("Pagination is out of range.");
    return number;
  }
  const page = parse(pageInput, 1, 1000000);
  const limit = parse(limitInput, 20, 100);
  return { page, limit, skip: (page - 1) * limit };
}
