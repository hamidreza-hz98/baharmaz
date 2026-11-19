"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import type { Point } from "@/server/delivery/policy";

export function DeliveryZoneMap({
  points,
  onChange,
}: {
  points: Point[];
  onChange: (points: Point[]) => void;
}) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const latestPoints = useRef(points);
  const latestChange = useRef(onChange);
  useEffect(() => {
    latestPoints.current = points;
    latestChange.current = onChange;
  }, [points, onChange]);
  useEffect(() => {
    let disposed = false;
    let dispose = () => {};
    void import("leaflet").then((L) => {
      if (disposed || !node.current) return;
      const instance = L.map(node.current).setView([35.69972, 51.33722], 12);
      map.current = instance;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>',
        maxZoom: 19,
      }).addTo(instance);
      layer.current = L.layerGroup().addTo(instance);
      if (latestPoints.current.length >= 3)
        L.polygon(
          latestPoints.current.map((p) => [p.lat, p.lng]),
          { color: "#6a242a", fillOpacity: 0.15 },
        ).addTo(layer.current);
      latestPoints.current.forEach((p) =>
        L.circleMarker([p.lat, p.lng], {
          radius: 5,
          color: "#6a242a",
          fillColor: "white",
          fillOpacity: 1,
        }).addTo(layer.current!),
      );
      if (latestPoints.current.length)
        instance.fitBounds(
          L.latLngBounds(
            latestPoints.current.map((p) => [p.lat, p.lng] as [number, number]),
          ),
          { padding: [25, 25], maxZoom: 15 },
        );
      instance.on("click", (event) =>
        latestChange.current([
          ...latestPoints.current,
          {
            lat: Number(event.latlng.lat.toFixed(6)),
            lng: Number(event.latlng.lng.toFixed(6)),
          },
        ]),
      );
      instance.whenReady(() => instance.invalidateSize());
      dispose = () => {
        instance.remove();
        map.current = null;
        layer.current = null;
      };
    });
    return () => {
      disposed = true;
      dispose();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !layer.current) return;
      layer.current.clearLayers();
      if (points.length >= 3)
        L.polygon(
          points.map((p) => [p.lat, p.lng]),
          { color: "#6a242a", fillOpacity: 0.15 },
        ).addTo(layer.current);
      else if (points.length === 2)
        L.polyline(
          points.map((p) => [p.lat, p.lng]),
          { color: "#6a242a" },
        ).addTo(layer.current);
      points.forEach((p) =>
        L.circleMarker([p.lat, p.lng], {
          radius: 5,
          color: "#6a242a",
          fillColor: "white",
          fillOpacity: 1,
        }).addTo(layer.current!),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [points]);
  return (
    <div
      ref={node}
      className="address-map"
      role="application"
      aria-label="نقشه محدوده ارسال؛ برای افزودن گوشه محدوده روی نقشه بزنید"
    />
  );
}
