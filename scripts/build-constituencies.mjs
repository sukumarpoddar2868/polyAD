/**
 * Build src/features/constituencies/data/up-ac.json from DataMeet's
 * Assembly Constituency shapefile (2008 delimitation, CC BY 2.5 India,
 * https://github.com/datameet/maps/tree/master/assembly-constituencies).
 *
 *   pnpm run build:constituencies <folder with India_AC.shp + India_AC.dbf>
 *
 * Output per seat: number, name, SC/ST reservation, district, Lok Sabha seat,
 * centroid, bbox and a simplified boundary (~50 m tolerance, 5-decimal coords).
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as shp from "shapefile";
import simplify from "@turf/simplify";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: pnpm run build:constituencies <folder with India_AC.shp>");
  process.exit(1);
}
const out = join(dirname(fileURLToPath(import.meta.url)), "../src/features/constituencies/data/up-ac.json");

// Districts renamed after 2008 (the shapefile keeps the old names; some carry a stray "*").
const RENAMED = {
  ALLAHABAD: "Prayagraj",
  FAIZABAD: "Ayodhya",
  "JYOTIBA PHULE NAGAR": "Amroha",
  "SANT RAVIDAS NAGAR": "Bhadohi",
  KHERI: "Lakhimpur Kheri",
};
// Seats whose reservation changed after 2008: Obra and Duddhi became ST seats in 2017.
const RESERVED_NOW = { 402: "ST", 403: "ST" };
const clean = (s) => s.replace(/\*/g, "").trim();
const title = (raw) =>
  RENAMED[clean(raw).toUpperCase()] ??
  clean(raw)
    .toLowerCase()
    .replace(/(^|[\s(.-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

const round = (n) => Math.round(n * 1e5) / 1e5;
const roundRing = (ring) => {
  const r = ring.map(([x, y]) => [round(x), round(y)]);
  return r.filter((p, i) => i === 0 || p[0] !== r[i - 1][0] || p[1] !== r[i - 1][1]);
};

/** Area-weighted centroid of the largest outer ring (good enough for a label/fallback pin). */
function centroid(rings) {
  let best = rings[0], bestA = 0;
  for (const ring of rings) {
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    if (Math.abs(a) > bestA) [best, bestA] = [ring, Math.abs(a)];
  }
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = best.length - 1; i < best.length; j = i++) {
    const f = best[j][0] * best[i][1] - best[i][0] * best[j][1];
    a += f; cx += (best[j][0] + best[i][0]) * f; cy += (best[j][1] + best[i][1]) * f;
  }
  return [round(cx / (3 * a)), round(cy / (3 * a))];
}

const src = await shp.open(join(dir, "India_AC.shp"), join(dir, "India_AC.dbf"));
const seats = [];
for (let r = await src.read(); !r.done; r = await src.read()) {
  const f = r.value;
  const p = f.properties;
  if (p.ST_NAME?.trim().toUpperCase() !== "UTTAR PRADESH") continue;

  const g = simplify(f, { tolerance: 0.0005, highQuality: true }).geometry;
  const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates)
    .map((poly) => poly.map(roundRing).filter((ring) => ring.length >= 4))
    .filter((poly) => poly.length);

  const xs = polys.flat(2).map((c) => c[0]);
  const ys = polys.flat(2).map((c) => c[1]);
  const m = String(p.AC_NAME).trim().match(/^(.*?)\s*\((SC|ST)\)\s*$/i);
  const pm = String(p.PC_NAME).trim().match(/^(.*?)\s*\((SC|ST)\)\s*$/i);

  seats.push({
    no: p.AC_NO,
    name: (m ? m[1] : String(p.AC_NAME)).trim(),
    reserved: RESERVED_NOW[p.AC_NO] ?? (m ? m[2].toUpperCase() : null),
    district: title(String(p.DIST_NAME)),
    pc: { no: p.PC_NO, name: title(pm ? pm[1] : String(p.PC_NAME)), reserved: pm ? pm[2].toUpperCase() : null },
    centroid: centroid(polys.map((poly) => poly[0])),
    bbox: [round(Math.min(...xs)), round(Math.min(...ys)), round(Math.max(...xs)), round(Math.max(...ys))],
    polygons: polys,
  });
}

seats.sort((a, b) => a.no - b.no);
if (seats.length !== 403 || new Set(seats.map((s) => s.no)).size !== 403) {
  throw new Error(`Expected 403 distinct UP seats, got ${seats.length}`);
}

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  JSON.stringify({
    state: "Uttar Pradesh",
    source: "DataMeet India — Assembly Constituencies (2008 delimitation), CC BY 2.5 India. Boundaries are approximate.",
    seats,
  }),
);
console.log(`Wrote ${seats.length} seats → ${out}`);
