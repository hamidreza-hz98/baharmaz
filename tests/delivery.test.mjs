import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validatePolicy,
  zoneFor,
  availableDays,
  canonicalDate,
} from "../src/server/delivery/policy.ts";
const policy = () => ({
  zones: [
    {
      id: "z1",
      name: "نمونه",
      feeRials: 450000,
      polygon: [
        { lat: 35, lng: 51 },
        { lat: 35, lng: 52 },
        { lat: 36, lng: 52 },
        { lat: 36, lng: 51 },
      ],
    },
  ],
  slots: [
    {
      id: "morning",
      label: "صبح",
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      start: "20:00",
      end: "21:00",
      capacity: null,
    },
  ],
  closures: [],
  leadMinutes: 60,
  cutoffDaysBefore: 0,
  cutoffTime: "19:00",
  horizonDays: 3,
  quoteTtlSeconds: 600,
});
test("delivery policies reject malformed fees, polygons, times and missing decisions", () => {
  assert.throws(() => validatePolicy({ ...policy(), leadMinutes: undefined }));
  assert.throws(() =>
    validatePolicy({
      ...policy(),
      zones: [{ ...policy().zones[0], feeRials: 11 }],
    }),
  );
  assert.throws(() =>
    validatePolicy({
      ...policy(),
      zones: [
        {
          ...policy().zones[0],
          polygon: [
            { lat: 0, lng: 0 },
            { lat: 1, lng: 1 },
            { lat: 2, lng: 2 },
          ],
        },
      ],
    }),
  );
  assert.throws(() =>
    validatePolicy({
      ...policy(),
      slots: [{ ...policy().slots[0], start: "22:00", end: "20:00" }],
    }),
  );
  assert.throws(() =>
    validatePolicy({ ...policy(), closures: ["2025-02-29"] }),
  );
});
test("coverage is deterministic and ambiguous overlaps fail closed", () => {
  const p = validatePolicy(policy());
  assert.equal(zoneFor(p.zones, { lat: 35.5, lng: 51.5 }).status, "covered");
  assert.equal(zoneFor(p.zones, { lat: 35, lng: 51.5 }).status, "covered");
  assert.equal(zoneFor(p.zones, { lat: 37, lng: 51.5 }).status, "outside");
  assert.equal(
    zoneFor([...p.zones, { ...p.zones[0], id: "z2" }], { lat: 35.5, lng: 51.5 })
      .status,
    "ambiguous",
  );
});
test("Tehran Jalali days enforce closures, lead time, cutoff and unimplemented capacity", () => {
  const p = validatePolicy(policy());
  const now = Date.parse("2025-03-20T14:00:00Z");
  const days = availableDays(p, now);
  assert.equal(days[0].date, "1403/12/30");
  assert.equal(days[1].date, "1404/01/01");
  assert.equal(days[0].slots[0].available, true);
  assert.equal(canonicalDate("۱۴۰۴/۱/۱"), "1404/01/01");
  const closed = availableDays({ ...p, closures: ["2025-03-20"] }, now);
  assert.equal(closed[0].slots[0].reason, "closed");
  const late = availableDays(p, Date.parse("2025-03-20T16:00:00Z"));
  assert.equal(late[0].slots[0].reason, "cutoff");
  const limited = availableDays(
    { ...p, slots: [{ ...p.slots[0], capacity: 3 }] },
    now,
  );
  assert.equal(limited[0].slots[0].reason, "capacity_unavailable");
});
