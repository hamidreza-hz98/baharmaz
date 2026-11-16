import test from "node:test";
import assert from "node:assert/strict";
import { dashboardRange } from "../src/shared/dashboard-period.ts";
test("dashboard ranges use Tehran civil boundaries across the new year", () => {
  const now = Date.parse("2026-03-20T20:45:00Z");
  assert.equal(
    dashboardRange("day", now).start.toISOString(),
    "2026-03-20T20:30:00.000Z",
  );
  assert.equal(
    dashboardRange("week", now).start.toISOString(),
    "2026-03-14T20:30:00.000Z",
  );
  assert.equal(
    dashboardRange("month", now).start.toISOString(),
    "2026-02-19T20:30:00.000Z",
  );
  assert.equal(
    dashboardRange("year", now).start.toISOString(),
    "2025-03-31T20:30:00.000Z",
  );
  assert.equal(
    dashboardRange("year", now).end.toISOString(),
    "2026-03-31T20:30:00.000Z",
  );
  assert.throws(() => dashboardRange("bad", now), RangeError);
});
