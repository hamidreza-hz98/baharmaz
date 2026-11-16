import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import { toJalaali } from "jalaali-js";
import { parseJalaliDate } from "../../shared/locale.ts";
export type Point = { lat: number; lng: number };
export type DeliveryPolicy = {
  zones: { id: string; name: string; feeRials: number; polygon: Point[] }[];
  slots: {
    id: string;
    label: string;
    weekdays: number[];
    start: string;
    end: string;
    capacity: number | null;
  }[];
  closures: string[];
  leadMinutes: number;
  cutoffDaysBefore: number;
  cutoffTime: string;
  horizonDays: number;
  quoteTtlSeconds: number;
};
const record = (x: unknown, keys: string[]) => {
  if (
    !x ||
    typeof x !== "object" ||
    Array.isArray(x) ||
    Object.keys(x).some((k) => !keys.includes(k))
  )
    throw new RangeError("Invalid object");
  return x as Record<string, unknown>;
};
const integer = (x: unknown, min: number, max: number) => {
  if (typeof x !== "number" || !Number.isSafeInteger(x) || x < min || x > max)
    throw new RangeError("Invalid integer");
  return x;
};
const text = (x: unknown, max: number) => {
  if (
    typeof x !== "string" ||
    !x.trim() ||
    x.trim().length > max ||
    /[\u0000-\u001f\u007f]/.test(x)
  )
    throw new RangeError("Invalid text");
  return x.trim().normalize("NFKC");
};
const id = (x: unknown) => {
  if (typeof x !== "string" || !/^[a-z0-9_-]{1,64}$/i.test(x))
    throw new RangeError("Invalid id");
  return x;
};
const time = (x: unknown) => {
  if (typeof x !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(x))
    throw new RangeError("Invalid time");
  return x;
};
function list<T>(x: unknown, max: number, parse: (v: unknown) => T): T[] {
  if (!Array.isArray(x) || x.length > max) throw new RangeError("Invalid list");
  return x.map(parse);
}
function point(x: unknown): Point {
  const p = record(x, ["lat", "lng"]);
  if (
    typeof p.lat !== "number" ||
    typeof p.lng !== "number" ||
    !Number.isFinite(p.lat) ||
    !Number.isFinite(p.lng) ||
    Math.abs(p.lat) > 90 ||
    Math.abs(p.lng) > 180
  )
    throw new RangeError("Invalid point");
  return { lat: p.lat, lng: p.lng };
}
function unique(ids: string[]) {
  if (new Set(ids).size !== ids.length) throw new RangeError("Duplicate id");
}
function validPolygon(polygon: Point[]) {
  if (
    polygon.length < 3 ||
    new Set(polygon.map((p) => `${p.lat},${p.lng}`)).size !== polygon.length
  )
    return false;
  const orient = (a: Point, b: Point, c: Point) =>
    (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  let area = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    area += a.lng * b.lat - b.lng * a.lat;
    for (let j = i + 1; j < polygon.length; j++) {
      if (j === i + 1 || (i === 0 && j === polygon.length - 1)) continue;
      const c = polygon[j],
        d = polygon[(j + 1) % polygon.length];
      const abC = orient(a, b, c),
        abD = orient(a, b, d),
        cdA = orient(c, d, a),
        cdB = orient(c, d, b);
      const on = (p: Point, q: Point, r: Point) =>
        Math.abs(orient(p, q, r)) < 1e-12 &&
        r.lat >= Math.min(p.lat, q.lat) &&
        r.lat <= Math.max(p.lat, q.lat) &&
        r.lng >= Math.min(p.lng, q.lng) &&
        r.lng <= Math.max(p.lng, q.lng);
      if (
        (abC * abD < 0 && cdA * cdB < 0) ||
        on(a, b, c) ||
        on(a, b, d) ||
        on(c, d, a) ||
        on(c, d, b)
      )
        return false;
    }
  }
  return Math.abs(area) > 1e-10;
}
export function validatePolicy(input: unknown): DeliveryPolicy {
  const p = record(input, [
    "zones",
    "slots",
    "closures",
    "leadMinutes",
    "cutoffDaysBefore",
    "cutoffTime",
    "horizonDays",
    "quoteTtlSeconds",
  ]);
  const zones = list(p.zones, 100, (v) => {
    const z = record(v, ["id", "name", "feeRials", "polygon"]);
    const feeRials = integer(z.feeRials, 0, Number.MAX_SAFE_INTEGER);
    if (feeRials % 10 !== 0) throw new RangeError("Whole tomans required");
    const polygon = list(z.polygon, 200, point);
    if (!validPolygon(polygon)) throw new RangeError("Invalid polygon");
    return { id: id(z.id), name: text(z.name, 100), feeRials, polygon };
  });
  const slots = list(p.slots, 100, (v) => {
    const s = record(v, [
      "id",
      "label",
      "weekdays",
      "start",
      "end",
      "capacity",
    ]);
    const weekdays = list(s.weekdays, 7, (v) => integer(v, 1, 7));
    unique(weekdays.map(String));
    const start = time(s.start),
      end = time(s.end);
    if (!weekdays.length || end <= start) throw new RangeError("Invalid slot");
    return {
      id: id(s.id),
      label: text(s.label, 100),
      weekdays,
      start,
      end,
      capacity: s.capacity === null ? null : integer(s.capacity, 1, 100000),
    };
  });
  const closures = list(p.closures, 1000, (v) => {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v))
      throw new RangeError("Invalid closure");
    Temporal.PlainDate.from(v, { overflow: "reject" });
    return v;
  });
  unique(zones.map((z) => z.id));
  unique(slots.map((s) => s.id));
  unique(closures);
  return {
    zones,
    slots,
    closures,
    leadMinutes: integer(p.leadMinutes, 0, 43200),
    cutoffDaysBefore: integer(p.cutoffDaysBefore, 0, 30),
    cutoffTime: time(p.cutoffTime),
    horizonDays: integer(p.horizonDays, 1, 90),
    quoteTtlSeconds: integer(p.quoteTtlSeconds, 60, 86400),
  };
}
export function zoneFor(zones: DeliveryPolicy["zones"], p: Point) {
  const contains = (poly: Point[]) => {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[j],
        b = poly[i];
      const cross =
        (p.lng - a.lng) * (b.lat - a.lat) - (p.lat - a.lat) * (b.lng - a.lng);
      if (
        Math.abs(cross) < 1e-10 &&
        p.lng >= Math.min(a.lng, b.lng) - 1e-10 &&
        p.lng <= Math.max(a.lng, b.lng) + 1e-10 &&
        p.lat >= Math.min(a.lat, b.lat) - 1e-10 &&
        p.lat <= Math.max(a.lat, b.lat) + 1e-10
      )
        return true;
      if (
        a.lat > p.lat !== b.lat > p.lat &&
        p.lng < ((b.lng - a.lng) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lng
      )
        inside = !inside;
    }
    return inside;
  };
  const matches = zones.filter((z) => contains(z.polygon));
  return matches.length === 1
    ? { status: "covered" as const, zone: matches[0] }
    : matches.length
      ? { status: "ambiguous" as const }
      : { status: "outside" as const };
}
function tehranInstant(date: Temporal.PlainDate, hm: string) {
  const [hour, minute] = hm.split(":").map(Number);
  return Temporal.ZonedDateTime.from(
    {
      timeZone: "Asia/Tehran",
      year: date.year,
      month: date.month,
      day: date.day,
      hour,
      minute,
    },
    { disambiguation: "reject" },
  ).epochMilliseconds;
}
export function availableDays(policy: DeliveryPolicy, now: number) {
  const local =
    Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(
      "Asia/Tehran",
    );
  const today = local.toPlainDate();
  const result: {
    date: string;
    label: string;
    slots: {
      id: string;
      label: string;
      start: string;
      end: string;
      available: boolean;
      reason: string | null;
    }[];
  }[] = [];
  for (let n = 0; n < policy.horizonDays; n++) {
    const day = today.add({ days: n });
    const j = toJalaali(day.year, day.month, day.day);
    const date = `${j.jy}/${String(j.jm).padStart(2, "0")}/${String(j.jd).padStart(2, "0")}`;
    const closed = policy.closures.includes(day.toString());
    const cutoff = tehranInstant(
      day.subtract({ days: policy.cutoffDaysBefore }),
      policy.cutoffTime,
    );
    const slots = policy.slots
      .filter((s) => s.weekdays.includes(day.dayOfWeek))
      .map((s) => {
        const start = tehranInstant(day, s.start);
        const reason = closed
          ? "closed"
          : s.capacity !== null
            ? "capacity_unavailable"
            : now > cutoff
              ? "cutoff"
              : now + policy.leadMinutes * 60000 > start
                ? "lead_time"
                : null;
        return {
          id: s.id,
          label: s.label,
          start: s.start,
          end: s.end,
          available: reason === null,
          reason,
        };
      });
    result.push({
      date,
      label: new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "Asia/Tehran",
      }).format(new Date(tehranInstant(day, "12:00"))),
      slots,
    });
  }
  return result;
}
export function canonicalDate(value: unknown) {
  if (typeof value !== "string") throw new RangeError("Invalid date");
  const d = parseJalaliDate(value);
  return `${d.year}/${String(d.month).padStart(2, "0")}/${String(d.day).padStart(2, "0")}`;
}
