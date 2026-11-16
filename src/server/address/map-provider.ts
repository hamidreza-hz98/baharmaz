import "server-only";
import mongoose, { Schema } from "mongoose";
import type { Coordinates } from "../../shared/address.ts";
const schema = new Schema(
  { _id: String, nextAt: Date },
  { versionKey: false, autoIndex: false },
);
export const GeocodeRate =
  mongoose.models.GeocodeRate || mongoose.model("GeocodeRate", schema);
export class GeocodeBusy extends Error {}
export function publicMapConfig(env: NodeJS.ProcessEnv = process.env) {
  const template = env.MAP_TILE_URL?.trim() || "";
  const attribution = env.MAP_ATTRIBUTION?.trim() || "";
  if (!template && !attribution) return { enabled: false as const };
  if (
    template.length > 2048 ||
    attribution.length < 1 ||
    attribution.length > 300 ||
    /[<>\u0000-\u001f]/.test(attribution) ||
    !["{z}", "{x}", "{y}"].every((s) => template.includes(s))
  )
    throw new Error("Invalid map configuration");
  const url = new URL(
    template
      .replaceAll("{z}", "1")
      .replaceAll("{x}", "1")
      .replaceAll("{y}", "1"),
  );
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("Invalid map URL");
  return { enabled: true as const, template, attribution };
}
export function reverseConfig(env: NodeJS.ProcessEnv = process.env) {
  const value = env.GEOCODER_URL?.trim();
  if (!value) return null;
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash ||
    url.hostname.toLowerCase() === "nominatim.openstreetmap.org"
  )
    throw new Error("Invalid geocoder URL");
  return url;
}
export async function reserveGeocode(now = Date.now()) {
  try {
    const result = await GeocodeRate.findOneAndUpdate(
      {
        _id: "global",
        $or: [
          { nextAt: { $lte: new Date(now) } },
          { nextAt: { $exists: false } },
        ],
      },
      { $set: { nextAt: new Date(now + 1000) } },
      { upsert: true, new: true },
    );
    if (!result) throw new GeocodeBusy();
  } catch (error) {
    if (
      error instanceof GeocodeBusy ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000)
    )
      throw new GeocodeBusy();
    throw error;
  }
}
export async function reverseGeocode(
  coords: Coordinates,
  env: NodeJS.ProcessEnv = process.env,
  fetcher: typeof fetch = fetch,
) {
  const url = reverseConfig(env);
  if (!url) return null;
  url.searchParams.set("lat", String(coords.lat));
  url.searchParams.set("lon", String(coords.lng));
  url.searchParams.set("format", "jsonv2");
  const response = await fetcher(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Provider unavailable");
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 65536) throw new Error("Response too large");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing provider response");
  const decoder = new TextDecoder();
  let body = "";
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 65536) {
      await reader.cancel();
      throw new Error("Response too large");
    }
    body += decoder.decode(value, { stream: true });
  }
  body += decoder.decode();
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error("Invalid provider response");
  }
  const display =
    data && typeof data === "object" && "display_name" in data
      ? (data as { display_name: unknown }).display_name
      : null;
  if (typeof display !== "string") throw new Error("Invalid provider response");
  const result = display.trim();
  if (!result || result.length > 1000 || /[\u0000-\u001f\u007f]/.test(result))
    throw new Error("Invalid provider response");
  return result;
}
