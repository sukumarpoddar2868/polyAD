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
