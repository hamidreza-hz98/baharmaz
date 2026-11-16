# Locale and domain primitives

`src/shared/locale.ts` is framework-independent. Invalid input throws `RangeError`; callers should validate at server boundaries and translate failures into safe Persian messages. These helpers do not replace authorization, persistence validation, uniqueness constraints or server-authoritative pricing.

## Numbers and mobile

`normalizeDigits` converts Persian and Arabic-Indic digits to ASCII. Mobile normalization accepts local `09…`, `98…`, `0098…`, and `+98…` with ordinary spaces, hyphens or parentheses, and returns exactly 11 ASCII digits beginning `09`. It checks syntax only; it does not prove a number is assigned or verified. Store the normalized value and enforce uniqueness on the server.

## Calendar and time

Jalali civil dates use `{ year, month, day }`, validated for years 1200–1600. `parseJalaliDate` accepts Persian, Arabic or ASCII digits and slash or hyphen separators. The limited range avoids reliance on calendar algorithms beyond the practical range where the chosen library and Intl agree. A civil date is not an instant: do not store a birthday as a UTC timestamp. `tehranInstantFromJalali` explicitly interprets a wall time in `Asia/Tehran` and produces an ISO UTC instant. It rejects invalid or ambiguous/skipped local times, including historical daylight-saving transitions, so callers must request a valid selection. `formatTehranJalali` requires an offset-bearing timestamp and formats the Tehran local date/time in Persian digits. Persist actual instants in UTC; retain civil dates as structured dates when no instant is intended. Timezone behavior depends on the runtime's IANA timezone data; keep the runtime updated.

## Currency and rounding

The working canonical unit is a non-negative **integer rial** stored and calculated on the server. One toman is exactly ten rials. All operations reject non-integers, negatives, unsafe integers and overflow; multiplication and percentage intermediates use BigInt, and API/JSON values remain safe JavaScript integers. Discount rates are integer basis points (10,000 = 100%); the discount is rounded to the nearest rial, ties upward. Calculate totals from trusted server data and specify the order of operations in each future pricing service.

Display is explicitly labeled `تومان` or `ریال`. Toman display/conversion requires an amount divisible by ten; a remainder raises an error instead of silently losing money. This is a temporary explicit policy: product pricing and discounts must enforce compatible totals or obtain an approved rounding rule. Confirm the canonical unit, rounding at the final payable total and the payment provider's expected unit at integration time. Use explicit conversion at that boundary; never assume the gateway unit or trust client totals.

## Slugs and pagination

Slugs normalize common Arabic letter variants, digits, marks and separators, preserve Unicode letters and numbers, and cap output at 80 code points; empty or excessively long inputs fail. Encode slugs when constructing URLs and escape untrusted text when rendering. A slug is not a unique identifier or an HTML sanitizer: enforce uniqueness atomically in the data layer and resolve conflicts there.

Pagination defaults to page 1 and 20 items; accepted pages are 1–1,000,000 and limits 1–100. Digits may be Persian, Arabic or ASCII. Invalid, fractional, negative, overflow and out-of-range values fail rather than being silently clamped. The returned offset is bounded; future endpoints must define stable sorting and consider cursor pagination for large datasets.

Run `npm run test:unit` for input validation, mixed digits, Jalali leap/New Year and timezone boundaries, integer rounding/overflow, slug and pagination cases.
