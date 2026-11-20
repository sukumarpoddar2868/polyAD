"use client";

import { useEffect, useRef } from "react";
import { Map as MapLibre, NavigationControl, setWorkerUrl, type GeoJSONSource, type GeoJSONSourceSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Circle, Polygons } from "../cover";

/**
 * Seat boundary (dark outline) vs the circles Meta will actually target (tinted).
 * Loaded client-only via next/dynamic.
 */
const STYLE = "https://tiles.openfreemap.org/styles/positron";
const UP: [number, number] = [80.9, 26.9];

function circleRing({ lat, lng, radiusKm }: Circle, steps = 48): [number, number][] {
  const d = radiusKm / 6371, φ1 = (lat * Math.PI) / 180, λ1 = (lng * Math.PI) / 180;
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const θ = (2 * Math.PI * i) / steps;
    const φ2 = Math.asin(Math.sin(φ1) * Math.cos(d) + Math.cos(φ1) * Math.sin(d) * Math.cos(θ));
    const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(d) * Math.cos(φ1), Math.cos(d) - Math.sin(φ1) * Math.sin(φ2));
    out.push([(λ2 * 180) / Math.PI, (φ2 * 180) / Math.PI]);
  }
  return out;
}

export type MapSeat = { polygons: Polygons; bbox: [number, number, number, number]; circles: Circle[] };

type Data = Exclude<GeoJSONSourceSpecification["data"], string>;
const fc = (features: object[]) => ({ type: "FeatureCollection", features }) as Data;

function setData(map: MapLibre, seats: MapSeat[]) {
  (map.getSource("seat") as GeoJSONSource | undefined)?.setData(
    fc(seats.map((s) => ({ type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: s.polygons } }))),
  );
  (map.getSource("circles") as GeoJSONSource | undefined)?.setData(
    fc(seats.flatMap((s) => s.circles.map((c) => ({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [circleRing(c)] } })))),
  );
  if (seats.length) {
    const b = seats.reduce((a, s) => [Math.min(a[0], s.bbox[0]), Math.min(a[1], s.bbox[1]), Math.max(a[2], s.bbox[2]), Math.max(a[3], s.bbox[3])], [180, 90, -180, -90]);
    map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 40, duration: 600 });
  }
}

export default function SeatMap({ seats }: { seats: MapSeat[] }) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  const ready = useRef(false);
  const latest = useRef(seats);

  useEffect(() => {
    latest.current = seats;
    if (mapRef.current && ready.current) setData(mapRef.current, seats);
  }, [seats]);

  useEffect(() => {
    if (!box.current) return;
    setWorkerUrl("/vendor/maplibre-gl-worker.mjs");
    const map = new MapLibre({ container: box.current, style: STYLE, center: UP, zoom: 5.6, attributionControl: { compact: true } });
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => {
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue("--color-lavender-deep").trim() || "purple";
      const ink = css.getPropertyValue("--color-ink").trim() || "black";
      map.addSource("circles", { type: "geojson", data: fc([]) });
      map.addSource("seat", { type: "geojson", data: fc([]) });
      map.addLayer({ id: "circles-fill", type: "fill", source: "circles", paint: { "fill-color": accent, "fill-opacity": 0.12 } });
      map.addLayer({ id: "circles-line", type: "line", source: "circles", paint: { "line-color": accent, "line-width": 1, "line-opacity": 0.6 } });
      map.addLayer({ id: "seat-line", type: "line", source: "seat", paint: { "line-color": ink, "line-width": 2.5 } });
      ready.current = true;
      setData(map, latest.current);
    });
    mapRef.current = map;
    return () => {
      ready.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={box} className="h-[480px] w-full overflow-hidden rounded-card" role="region" aria-label="Constituency map" />;
}
