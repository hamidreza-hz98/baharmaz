import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateAddress,
  validateCoordinates,
} from "../src/server/address/address.ts";
import {
  publicMapConfig,
  reverseConfig,
  reverseGeocode,
} from "../src/server/address/map-provider.ts";
const input = {
  label: "خانه",
  postalCode: "۱۲۳۴۵۶۷۸۹۰",
  recipient: "نام نمونه",
  mobile: "۰۹۱۲۳۴۵۶۷۸۹",
  address: "تهران، خیابان نمونه",
  coordinates: { lat: 35.7, lng: 51.4 },
};
test("address validates digits, optional coordinates and input bounds", () => {
  const x = validateAddress(input);
  assert.equal(x.mobile, "09123456789");
  assert.equal(x.postalCode, "1234567890");
  assert.equal(
    validateAddress({ ...input, postalCode: "", coordinates: null })
      .coordinates,
    null,
  );
  for (const value of [
    { lat: 91, lng: 1 },
    { lat: 1, lng: Infinity },
    { lat: 1, lng: 2, extra: true },
  ])
    assert.throws(() => validateCoordinates(value), RangeError);
  assert.throws(
    () => validateAddress({ ...input, postalCode: "۱۲۳" }),
    RangeError,
  );
  assert.throws(
    () => validateAddress({ ...input, customerId: "other" }),
    RangeError,
  );
});
test("map configuration and mocked reverse provider fail safely", async () => {
  assert.deepEqual(publicMapConfig({}), {
    enabled: true,
    template: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "© OpenStreetMap contributors",
  });
  assert.throws(() =>
    publicMapConfig({
      MAP_TILE_URL: "http://example.com/{z}/{x}/{y}",
      MAP_ATTRIBUTION: "map",
    }),
  );
  assert.throws(() =>
    reverseConfig({
      GEOCODER_URL: "https://nominatim.openstreetmap.org/reverse",
    }),
  );
  const env = { GEOCODER_URL: "https://geocoder.example/reverse?key=secret" };
  let called = "";
  const result = await reverseGeocode(
    { lat: 35.7, lng: 51.4 },
    env,
    async (url) => {
      called = String(url);
      return new Response(
        JSON.stringify({ display_name: "تهران، نشانی نمونه" }),
        { status: 200 },
      );
    },
  );
  assert.equal(result, "تهران، نشانی نمونه");
  assert.match(called, /lat=35.7/);
  await assert.rejects(
    reverseGeocode(
      { lat: 0, lng: 0 },
      env,
      async () => new Response("fail", { status: 503 }),
    ),
  );
  await assert.rejects(
    reverseGeocode(
      { lat: 0, lng: 0 },
      env,
      async () => new Response("invalid json"),
    ),
    { message: "Invalid provider response" },
  );
});
