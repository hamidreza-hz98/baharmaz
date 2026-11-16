import { Temporal } from "@js-temporal/polyfill";
export const dashboardPeriods = ["day", "week", "month", "year"] as const;
export function dashboardRange(period: string, now = Date.now()) {
  if (!dashboardPeriods.includes(period as (typeof dashboardPeriods)[number]))
    throw new RangeError("Invalid period");
  const startOfDay = Temporal.Instant.fromEpochMilliseconds(now)
    .toZonedDateTimeISO("Asia/Tehran")
    .startOfDay();
  const start =
    period === "day"
      ? startOfDay
      : period === "week"
        ? startOfDay.subtract({ days: 6 })
        : period === "month"
          ? startOfDay.subtract({ days: 29 })
          : startOfDay.with({ day: 1 }).subtract({ months: 11 });
  const end =
    period === "year"
      ? startOfDay.with({ day: 1 }).add({ months: 1 })
      : startOfDay.add({ days: 1 });
  return {
    start: new Date(start.epochMilliseconds),
    end: new Date(end.epochMilliseconds),
    format:
      period === "day"
        ? "%Y-%m-%d %H:00"
        : period === "year"
          ? "%Y-%m"
          : "%Y-%m-%d",
  };
}
