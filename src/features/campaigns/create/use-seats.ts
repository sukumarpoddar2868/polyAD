"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { seatShapeAction, type SeatShape } from "@/features/constituencies/actions";
import type { SeatRef } from "@/features/constituencies/components/seat-chooser";
import type { MapSeat } from "@/features/constituencies/components/seat-map";
import type { Draft, DraftPin } from "./blueprint";

/** Circles per seat: 5 seats × 40 = Meta's 200 locations per ad set. */
const CIRCLES_PER_SEAT = 40;

/**
 * The campaign's constituencies — the only way PolyAd targets places.
 * Seats live as tagged circles in `audience.locations` (what Meta gets);
 * `setup.seats` mirrors them for the AI. Start and Audience both edit here.
 */
export function useSeats(draft: Draft, update: (fn: (d: Draft) => Draft) => void) {
  const [shapes, setShapes] = useState<Record<number, SeatShape>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const pins = draft.audience.locations;
  const seats: (SeatRef & { coverage: number; pins: DraftPin[] })[] = useMemo(() => {
    const out = new Map<number, SeatRef & { coverage: number; pins: DraftPin[] }>();
    for (const p of pins) {
      if (!p.seat) continue;
      const s = out.get(p.seat.no) ?? { no: p.seat.no, name: p.seat.name, coverage: p.seat.coverage, pins: [] };
      s.pins.push(p);
      out.set(s.no, s);
    }
    return [...out.values()];
  }, [pins]);

  // Seat outlines for the map (fetched once per seat).
  const missing = seats.filter((s) => !shapes[s.no]).map((s) => s.no).join(",");
  useEffect(() => {
    if (!missing) return;
    let live = true;
    Promise.all(missing.split(",").map((no) => seatShapeAction({ no: Number(no), maxCircles: CIRCLES_PER_SEAT }))).then((list) => {
      if (live) setShapes((all) => Object.fromEntries([...Object.entries(all), ...list.filter((s): s is SeatShape => !!s).map((s) => [s.no, s])]));
    });
    return () => {
      live = false;
    };
  }, [missing]);

  const mapSeats: MapSeat[] = seats.flatMap((s) =>
    shapes[s.no] ? [{ polygons: shapes[s.no].polygons, bbox: shapes[s.no].bbox, circles: s.pins.filter((p) => p.lat !== null && p.lng !== null).map((p) => ({ lat: p.lat!, lng: p.lng!, radiusKm: p.radiusKm })) }] : [],
  );

  /** Replace the chosen seats: removed seats drop their circles, new ones get theirs. */
  const setSeats = (next: SeatRef[]) => {
    setError(null);
    const keep = new Set(next.map((s) => s.no));
    const have = new Set(seats.map((s) => s.no));
    const added = next.filter((s) => !have.has(s.no));
    update((d) => ({ ...d, setup: { ...d.setup, seats: next }, audience: { ...d.audience, locations: d.audience.locations.filter((p) => p.seat && keep.has(p.seat.no)) } }));
    if (!added.length) return;
    start(async () => {
      const got = await Promise.all(added.map((s) => seatShapeAction({ no: s.no, maxCircles: CIRCLES_PER_SEAT })));
      if (got.some((g) => !g)) setError("Couldn't load a constituency. Try again.");
      const ok = got.filter((g): g is SeatShape => !!g);
      setShapes((all) => ({ ...all, ...Object.fromEntries(ok.map((s) => [s.no, s])) }));
      update((d) => {
        const present = new Set(d.audience.locations.map((p) => p.seat?.no));
        const wanted = new Set(d.setup.seats.map((s) => s.no));
        const fresh = ok
          .filter((s) => wanted.has(s.no) && !present.has(s.no))
          .flatMap((s) => {
            const name = d.setup.seats.find((x) => x.no === s.no)!.name;
            const tag = { no: s.no, name, coverage: s.cover.coverage };
            return s.cover.circles.map((c, i) => ({ name: `${name} ${i + 1}`, lat: c.lat, lng: c.lng, radiusKm: c.radiusKm, why: "", geo: null, seat: tag }));
          });
        return { ...d, audience: { ...d.audience, locations: [...d.audience.locations, ...fresh] } };
      });
    });
  };

  /** The chosen seats in order (falls back to the circles' tags for older drafts). */
  const chosen: SeatRef[] = draft.setup.seats.length ? draft.setup.seats : seats.map(({ no, name }) => ({ no, name }));

  return { chosen, seats, mapSeats, setSeats, pending, error };
}
