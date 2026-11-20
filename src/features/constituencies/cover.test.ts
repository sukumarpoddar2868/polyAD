import { test } from "node:test";
import assert from "node:assert/strict";
import { coverPolygons, type Polygons } from "./cover.ts";
import { getSeat, seatSummaries } from "./seats.ts";
import { searchSeats as find } from "./search.ts";
const searchSeats = (q: string) => find(seatSummaries(), q);

/** Axis-aligned square of `km` side centred on (lng, lat). */
function square(lng: number, lat: number, km: number): Polygons {
  const dy = km / 2 / 111.32, dx = km / 2 / (111.32 * Math.cos((lat * Math.PI) / 180));
  return [[[[lng - dx, lat - dy], [lng + dx, lat - dy], [lng + dx, lat + dy], [lng - dx, lat + dy], [lng - dx, lat - dy]]]];
}

test("a 30 km square is covered well within the cap", () => {
  const c = coverPolygons(square(80.9, 26.8, 30));
  assert.ok(c.circles.length >= 1 && c.circles.length <= 40);
  assert.ok(c.coverage > 0.9, `coverage ${c.coverage}`);
  assert.ok(c.spill < 0.35, `spill ${c.spill}`);
  assert.ok(Math.abs(c.areaKm2 - 900) < 60, `area ${c.areaKm2}`);
  assert.ok(Number.isInteger(c.radiusKm));
});

test("smaller cap → larger circles", () => {
  const a = coverPolygons(square(80.9, 26.8, 30), { maxCircles: 40 });
  const b = coverPolygons(square(80.9, 26.8, 30), { maxCircles: 5 });
  assert.ok(b.radiusKm > a.radiusKm);
  assert.ok(b.circles.length <= 5);
});

test("a tiny seat still gets one circle", () => {
  const c = coverPolygons(square(80.9, 26.8, 0.5), { centroid: [80.9, 26.8] });
  assert.equal(c.circles.length, 1);
  assert.equal(c.radiusKm, 1);
});

test("real seats: Lucknow Central (urban) and Sarojini Nagar (rural)", () => {
  for (const no of [174, 170]) {
    const s = getSeat(no)!;
    const c = coverPolygons(s.polygons, { centroid: s.centroid });
    assert.ok(c.coverage > 0.85, `${s.name} coverage ${c.coverage}`);
    assert.ok(c.circles.length <= 40);
    for (const p of c.circles) {
      assert.ok(p.lng >= s.bbox[0] - 0.2 && p.lng <= s.bbox[2] + 0.2);
      assert.ok(p.lat >= s.bbox[1] - 0.2 && p.lat <= s.bbox[3] + 0.2);
    }
  }
  assert.ok(coverPolygons(getSeat(174)!.polygons).radiusKm < coverPolygons(getSeat(170)!.polygons).radiusKm);
});

test("search by number, name, district and Lok Sabha seat", () => {
  assert.equal(searchSeats("174")[0].name, "Lucknow Central");
  assert.equal(searchSeats("lucknow central")[0].no, 174);
  assert.ok(searchSeats("Lucknow").length >= 9);
  assert.ok(searchSeats("Prayagraj").every((s) => s.district === "Prayagraj" || s.name.includes("Prayagraj")));
  assert.equal(searchSeats("").length, 0);
  assert.equal(getSeat(999), null);
});
