/** Pure seat search over summary rows — usable in the browser (no geometry import). */
export type Reservation = "SC" | "ST" | null;
export type SeatSummary = {
  no: number;
  name: string;
  reserved: Reservation;
  district: string;
  pc: { no: number; name: string; reserved: Reservation };
  centroid: [number, number];
};

/** Seats per campaign: Meta allows 200 locations per ad set; a seat uses up to 40 circles. */
export const MAX_SEATS = 5;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Match by seat number, seat name, district or Lok Sabha seat; seat-name hits first. */
export function searchSeats<T extends SeatSummary>(seats: readonly T[], q: string, limit = 20): T[] {
  const n = norm(q);
  if (!n) return [];
  const num = /^\d+$/.test(q.trim()) ? Number(q.trim()) : null;
  const scored: [number, T][] = [];
  for (const s of seats) {
    const name = norm(s.name);
    const score =
      num !== null && s.no === num ? 0
      : name === n ? 1
      : name.startsWith(n) ? 2
      : name.includes(n) ? 3
      : norm(s.district).startsWith(n) ? 4
      : norm(s.pc.name).startsWith(n) ? 5
      : -1;
    if (score >= 0) scored.push([score, s]);
  }
  return scored.sort((a, b) => a[0] - b[0] || a[1].no - b[1].no).slice(0, limit).map(([, s]) => s);
}
