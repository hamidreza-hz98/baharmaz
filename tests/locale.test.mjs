import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeDigits,
  normalizeIranianMobile,
  parseJalaliDate,
  tehranInstantFromJalali,
  formatTehranJalali,
  sumRials,
  multiplyRials,
  discountRials,
  tomansToRials,
  rialsToTomans,
  formatMoney,
  makeSlug,
  parsePagination,
} from "../src/shared/locale.ts";

test("normalizes mixed Persian, Arabic and Latin digits and Iranian mobile prefixes", () => {
  assert.equal(normalizeDigits("۱۲٣4"), "1234");
  for (const input of [
    "۰۹۱۲۳۴۵۶۷۸۹",
    "+۹۸ (۹۱۲) ۳۴۵-۶۷۸۹",
    "00989123456789",
    "989123456789",
  ])
    assert.equal(normalizeIranianMobile(input), "09123456789");
  for (const input of [
    "02112345678",
    "+1909123456789",
    "0912345678",
    "0912ext3456789",
    "++989123456789",
  ])
    assert.throws(() => normalizeIranianMobile(input), RangeError);
});

test("validates Jalali leap days and converts Tehran New Year across UTC midnight", () => {
  const leap = parseJalaliDate("۱۳۹۹/۱۲/۳۰");
  assert.deepEqual(leap, { year: 1399, month: 12, day: 30 });
  assert.throws(() => parseJalaliDate("۱۴۰۰/۱۲/۳۰"), RangeError);
  assert.throws(() => parseJalaliDate("۱۴۰۳/۱۳/۰۱"), RangeError);
  assert.throws(() => parseJalaliDate("1403/1/1xyz"), RangeError);
  assert.equal(
    tehranInstantFromJalali(parseJalaliDate("۱۴۰۳/۱/۱")),
    "2024-03-19T20:30:00Z",
  );
  assert.equal(formatTehranJalali("2024-03-19T20:29:00Z"), "۱۴۰۲/۱۲/۲۹، ۲۳:۵۹");
  assert.equal(formatTehranJalali("2024-03-19T20:30:00Z"), "۱۴۰۳/۱/۱، ۰۰:۰۰");
  assert.throws(() => formatTehranJalali("2024-03-20T00:00:00"), RangeError);
  assert.throws(() => tehranInstantFromJalali(leap, 24, 0), RangeError);
  // Tehran skipped this local midnight when daylight saving time began in 2021.
  assert.throws(
    () => tehranInstantFromJalali(parseJalaliDate("1400/1/2")),
    RangeError,
  );
});

test("uses integer rials, exact conversion and half-up discount rounding", () => {
  assert.equal(tomansToRials(245000), 2450000);
  assert.equal(rialsToTomans(2450000), 245000);
  assert.equal(formatMoney(2450000), "۲۴۵,۰۰۰ تومان");
  assert.equal(formatMoney(101, "rial"), "۱۰۱ ریال");
  assert.throws(() => rialsToTomans(101), RangeError);
  assert.equal(discountRials(5, 1000), 1);
  assert.equal(discountRials(999, 10000), 999);
  assert.equal(sumRials([10, 20, 30]), 60);
  assert.equal(multiplyRials(13, 3), 39);
  for (const input of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(() => sumRials([input]), RangeError);
  assert.throws(() => discountRials(100, 10001), RangeError);
  assert.throws(() => tomansToRials(Number.MAX_SAFE_INTEGER), RangeError);
  assert.throws(() => sumRials([Number.MAX_SAFE_INTEGER, 1]), RangeError);
});

test("creates Unicode-safe slugs without treating markup as HTML", () => {
  assert.equal(makeSlug("  كيكِ مرغ و پنیر ۱۲۳  "), "کیک-مرغ-و-پنیر-123");
  assert.equal(makeSlug("Hello / World!"), "hello-world");
  assert.equal(makeSlug("<script>alert(1)</script>"), "script-alert-1-script");
  assert.throws(() => makeSlug("💛 --"), RangeError);
  assert.throws(() => makeSlug("a".repeat(501)), RangeError);
  assert.ok(Array.from(makeSlug("م".repeat(100))).length <= 80);
});

test("validates pagination and computes a bounded offset", () => {
  assert.deepEqual(parsePagination(), { page: 1, limit: 20, skip: 0 });
  assert.deepEqual(parsePagination("۲", "١٠"), {
    page: 2,
    limit: 10,
    skip: 10,
  });
  for (const value of [
    "",
    "0",
    "-1",
    "1.5",
    "1e3",
    "1000001",
    "999999999999999999999",
  ])
    assert.throws(() => parsePagination(value), RangeError);
  assert.throws(() => parsePagination("1", "101"), RangeError);
});
