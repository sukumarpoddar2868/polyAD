/**
 * Turn a constituency boundary into Meta-friendly targeting circles.
 *
 * Meta can't target an arbitrary polygon, only points + radius (custom_locations,
 * integer km). We lay a hex grid of equal circles over the seat (hex spacing r·√3
 * covers the plane with no gaps), keep circles that are mostly inside the seat,
 * and pick the smallest radius whose circle count fits the cap — smaller circles
 * hug the boundary better. Pure, no I/O: safe on server, client and in tests.
 */

export type LngLat = [number, number];
/** GeoJSON-style MultiPolygon coordinates: polygons → rings (first = outer) → points. */
export type Polygons = LngLat[][][];

export type Circle = { lat: number; lng: number; radiusKm: number };
export type Cover = {
  circles: Circle[];
  radiusKm: number;
  /** Share of the seat's area inside at least one circle (0–1). */
  coverage: number;
  /** Share of the circles' combined area that falls outside the seat (0–1). */
  spill: number;
  /** Seat area, km². */
  areaKm2: number;
};

export const RADIUS_STOPS_KM = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15] as const;
export const DEFAULT_MAX_CIRCLES = 40;
/** Keep a circle when at least this share of it lies inside the seat. */
const KEEP_INSIDE = 0.35;

const KM_PER_DEG = 111.32;

/** Equirectangular projection around a reference latitude — accurate to <1% at seat scale. */
function projector(refLat: number) {
  const kx = KM_PER_DEG * Math.cos((refLat * Math.PI) / 180);
  return {
    to: ([lng, lat]: LngLat): [number, number] => [lng * kx, lat * KM_PER_DEG],
    from: ([x, y]: [number, number]): LngLat => [x / kx, y / KM_PER_DEG],
  };
}

type Ring = [number, number][];
type Shape = { rings: Ring[]; minX: number; minY: number; maxX: number; maxY: number };

function toShape(polys: Polygons, to: (p: LngLat) => [number, number]): Shape {
  const rings = polys.flat().map((r) => r.map(to));
  const pts = rings.flat();
  return {
    rings,
    minX: Math.min(...pts.map((p) => p[0])),
    minY: Math.min(...pts.map((p) => p[1])),
    maxX: Math.max(...pts.map((p) => p[0])),
    maxY: Math.max(...pts.map((p) => p[1])),
  };
}

/** Even-odd rule over every ring, so holes and multi-part seats both work. */
function inside(s: Shape, x: number, y: number): boolean {
  if (x < s.minX || x > s.maxX || y < s.minY || y > s.maxY) return false;
  let hit = false;
  for (const r of s.rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i], [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
  }
  return hit;
}

/** Unit-disc sample offsets: centre + 3 rings (37 points, roughly area-uniform). */
const DISC = (() => {
  const out: [number, number][] = [[0, 0]];
  for (const [k, n] of [[1, 6], [2, 12], [3, 18]] as const) {
    const rr = k / 3.2;
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * (i + (k % 2) * 0.5)) / n;
      out.push([rr * Math.cos(a), rr * Math.sin(a)]);
    }
  }
  return out;
})();

function insideShare(s: Shape, cx: number, cy: number, r: number): number {
  let n = 0;
  for (const [dx, dy] of DISC) if (inside(s, cx + dx * r, cy + dy * r)) n++;
  return n / DISC.length;
}

function hexCenters(s: Shape, r: number): [number, number][] {
  const dx = r * Math.sqrt(3), dy = r * 1.5;
  const out: [number, number][] = [];
  let row = 0;
  for (let y = s.minY - r; y <= s.maxY + r; y += dy, row++) {
    for (let x = s.minX - r + (row % 2 ? dx / 2 : 0); x <= s.maxX + r; x += dx) out.push([x, y]);
  }
  return out;
}

function stats(s: Shape, circles: [number, number][], r: number) {
  const span = Math.max(s.maxX - s.minX, s.maxY - s.minY);
  const step = span / 70; // ~5k grid samples over the bbox (+ margin)
  const r2 = r * r;
  let seat = 0, seatCovered = 0, inCircles = 0, spill = 0;
  for (let x = s.minX - r; x <= s.maxX + r; x += step) {
    for (let y = s.minY - r; y <= s.maxY + r; y += step) {
      const inSeat = inside(s, x, y);
      const inCircle = circles.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= r2);
      if (inSeat) { seat++; if (inCircle) seatCovered++; }
      if (inCircle) { inCircles++; if (!inSeat) spill++; }
    }
  }
  return {
    coverage: seat ? seatCovered / seat : 0,
    spill: inCircles ? spill / inCircles : 0,
    areaKm2: seat * step * step,
  };
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

export function coverPolygons(
  polys: Polygons,
  opts: { maxCircles?: number; centroid?: LngLat } = {},
): Cover {
  const max = Math.max(1, opts.maxCircles ?? DEFAULT_MAX_CIRCLES);
  const all = polys.flat(2);
  const refLat = all.reduce((a, p) => a + p[1], 0) / all.length;
  const proj = projector(refLat);
  const s = toShape(polys, proj.to);

  const middle: [number, number] = opts.centroid ? proj.to(opts.centroid) : [(s.minX + s.maxX) / 2, (s.minY + s.maxY) / 2];
  let pick: { r: number; centers: [number, number][] } | null = null;
  for (const r of RADIUS_STOPS_KM) {
    const centers = hexCenters(s, r).filter(([x, y]) => insideShare(s, x, y, r) >= KEEP_INSIDE);
    if (!centers.length) {
      // Seat smaller than one circle: a single smallest circle in the middle.
      pick = { r: RADIUS_STOPS_KM[0], centers: [middle] };
      break;
    }
    if (centers.length <= max) { pick = { r, centers }; break; }
  }
  if (!pick) {
    // Too many circles even at the largest stop: keep the most-inside ones.
    const r = RADIUS_STOPS_KM[RADIUS_STOPS_KM.length - 1];
    const ranked = hexCenters(s, r)
      .map((c) => ({ c, share: insideShare(s, c[0], c[1], r) }))
      .sort((a, b) => b.share - a.share)
      .slice(0, max)
      .map((x) => x.c);
    pick = { r, centers: ranked };
  }

  const st = stats(s, pick.centers, pick.r);
  return {
    circles: pick.centers.map((c) => {
      const [lng, lat] = proj.from(c);
      return { lat: round(lat, 5), lng: round(lng, 5), radiusKm: pick.r };
    }),
    radiusKm: pick.r,
    coverage: round(st.coverage, 3),
    spill: round(st.spill, 3),
    areaKm2: Math.round(st.areaKm2),
  };
}
