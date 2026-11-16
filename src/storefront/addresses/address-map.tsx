"use client";
import { useEffect, useRef, useState } from "react";
import type { Coordinates } from "@/shared/address";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
type Config = { template: string; attribution: string };
export function AddressMap({
  config,
  coordinates,
  onChange,
}: {
  config: Config;
  coordinates: Coordinates | null;
  onChange: (point: Coordinates) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<CircleMarker | null>(null);
  const handler = useRef(onChange);
  const point = useRef(coordinates);
  const [error, setError] = useState(false);
  useEffect(() => {
    handler.current = onChange;
    point.current = coordinates;
  }, [onChange, coordinates]);
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    async function initialize() {
      try {
        const L = await import("leaflet");
        if (disposed || !node.current) return;
        const instance = L.map(node.current, { keyboard: true }).setView(
          point.current
            ? [point.current.lat, point.current.lng]
            : [35.6892, 51.389],
          point.current ? 15 : 11,
        );
        map.current = instance;
        if (point.current) {
          marker.current = L.circleMarker(
            [point.current.lat, point.current.lng],
            {
              radius: 9,
              color: "#63262b",
              fillOpacity: 0.8,
            },
          ).addTo(instance);
        }
        const attribution = config.attribution.replace(
          /[&<>"']/g,
          (c) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[c] || c,
        );
        let failures = 0;
        const tiles = L.tileLayer(config.template, { attribution, maxZoom: 19 })
          .on("tileerror", () => {
            failures++;
            if (failures >= 3) setError(true);
          })
          .addTo(instance);
        instance.on("click", (event) =>
          handler.current({
            lat: Number(event.latlng.lat.toFixed(6)),
            lng: Number(event.latlng.lng.toFixed(6)),
          }),
        );
        cleanup = () => {
          tiles.off();
          instance.remove();
          map.current = null;
          marker.current = null;
        };
      } catch {
        if (!disposed) setError(true);
      }
    }
    void initialize();
    return () => {
      disposed = true;
      cleanup();
    };
  }, [config]);
  useEffect(() => {
    let cancelled = false;
    async function mark() {
      const L = await import("leaflet");
      if (cancelled || !map.current) return;
      if (marker.current) {
        marker.current.remove();
        marker.current = null;
      }
      if (coordinates) {
        marker.current = L.circleMarker([coordinates.lat, coordinates.lng], {
          radius: 9,
          color: "#63262b",
          fillOpacity: 0.8,
        }).addTo(map.current);
        map.current.panTo([coordinates.lat, coordinates.lng]);
      }
    }
    void mark().catch(() => {
      if (!cancelled) setError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [coordinates]);
  return (
    <>
      <div
        ref={node}
        className="address-map"
        role="application"
        aria-label="نقشه انتخاب موقعیت؛ برای انتخاب دقیق از ورودی مختصات هم می‌توانید استفاده کنید"
        tabIndex={0}
      />
      {error && (
        <p role="status">
          تصاویر نقشه در دسترس نیست؛ مختصات و نشانی را دستی وارد کنید.
        </p>
      )}
    </>
  );
}
