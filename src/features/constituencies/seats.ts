/**
 * UP Assembly constituencies (403). Data: DataMeet, CC BY 2.5 India — credit it in the UI.
 * The JSON is ~900 KB: import this module only on the server.
 */
import data from "./data/up-ac.json" with { type: "json" };
import { coverPolygons, type Cover, type Polygons } from "./cover.ts";
import type { SeatSummary } from "./search.ts";

export type Seat = SeatSummary & { bbox: [number, number, number, number]; polygons: Polygons };

export const STATE = data.state;
export const SOURCE = data.source;
const SEATS = data.seats as unknown as Seat[];
const BY_NO = new Map(SEATS.map((s) => [s.no, s]));

export const getSeat = (no: number): Seat | null => BY_NO.get(no) ?? null;

const summary = (s: Seat): SeatSummary => ({ no: s.no, name: s.name, reserved: s.reserved, district: s.district, pc: s.pc, centroid: s.centroid });
export const seatSummaries = (): SeatSummary[] => SEATS.map(summary);

const covers = new Map<string, Cover>();
/** Covering circles for a seat (memoised per process; ~50 ms the first time). */
export function seatCover(no: number, maxCircles?: number): Cover | null {
  const s = getSeat(no);
  if (!s) return null;
  const key = `${no}:${maxCircles ?? ""}`;
  let c = covers.get(key);
  if (!c) covers.set(key, (c = coverPolygons(s.polygons, { centroid: s.centroid, maxCircles })));
  return c;
}

function inPolygons(polys: Polygons, lng: number, lat: number): boolean {
  let hit = false;
  for (const ring of polys.flat()) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

/**
 * Seats any of these circles reach (centre, half-radius and rim samples). Used
 * for the silence-period check, so it errs on the side of including a seat.
 */
export function seatsTouched(circles: { lat: number; lng: number; radiusKm: number }[]): number[] {
  const found = new Set<number>();
  for (const c of circles) {
    if (!c.lat && !c.lng) continue; // a Meta area without a map position
    const kx = 111.32 * Math.cos((c.lat * Math.PI) / 180);
    const pts: [number, number][] = [[c.lng, c.lat]];
    for (const f of [0.5, 1]) {
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        pts.push([c.lng + (Math.cos(a) * c.radiusKm * f) / kx, c.lat + (Math.sin(a) * c.radiusKm * f) / 111.32]);
      }
    }
    for (const s of SEATS) {
      if (found.has(s.no)) continue;
      const [w, so, e, n] = s.bbox;
      if (pts.some(([x, y]) => x >= w && x <= e && y >= so && y <= n && inPolygons(s.polygons, x, y))) found.add(s.no);
    }
  }
  return [...found].sort((a, b) => a - b);
}
