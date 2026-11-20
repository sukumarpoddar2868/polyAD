"use client";

import { useEffect, useState, useTransition } from "react";
import { Landmark } from "lucide-react";
import { Input } from "@/components/ui/field";
import type { DraftPin } from "@/features/campaigns/create/blueprint";
import { findSeatsAction, seatShapeAction } from "../actions";
import type { SeatSummary } from "../search";

const label = (s: SeatSummary) => `${s.no} · ${s.name}${s.reserved ? ` (${s.reserved})` : ""}`;

/** "Add a constituency": search UP seats, turn the chosen one into Meta circles. */
export function SeatPicker({ taken, room, onAdd }: { taken: number[]; room: number; onAdd: (pins: DraftPin[]) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SeatSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    let live = true;
    const t = setTimeout(() => findSeatsAction(term).then((r) => live && setHits(r)), 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const pick = (s: SeatSummary) => {
    setQ("");
    setHits([]);
    setError(null);
    if (taken.includes(s.no)) return setError(`${s.name} is already added.`);
    start(async () => {
      const shape = await seatShapeAction({ no: s.no, maxCircles: Math.min(40, room) });
      if (!shape) return setError("Couldn't load that seat.");
      if (shape.cover.circles.length > room) return setError(`No room: Meta allows 200 locations per ad set (${room} left).`);
      const seat = { no: s.no, name: s.name, coverage: shape.cover.coverage };
      onAdd(shape.cover.circles.map((c, i) => ({ name: `${s.name} ${i + 1}`, lat: c.lat, lng: c.lng, radiusKm: c.radiusKm, why: "", geo: null, seat })));
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="add-seat" className="text-[13px] font-bold">
        Add an Assembly constituency
      </label>
      <Input id="add-seat" value={q} placeholder="e.g. Lucknow Central · 174 · Gorakhpur" onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      {q.trim() !== "" && hits.length > 0 && (
        <ul className="flex flex-col rounded-card bg-paper p-1 shadow-md" role="listbox" aria-label="Matching constituencies">
          {hits.map((s) => (
            <li key={s.no}>
              <button type="button" onClick={() => pick(s)} className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-lavender-soft">
                <Landmark className="mt-0.5 size-4 shrink-0 text-lavender-deep" aria-hidden />
                <span>
                  <span className="block text-[14px] font-bold">{label(s)}</span>
                  <span className="block text-[12px] text-ink-muted">{s.district} · {s.pc.name} Lok Sabha</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {pending && <p className="text-[13px] text-ink-muted">Working out the circles…</p>}
      {error && <p className="text-[13px] text-tomato-700">{error}</p>}
      <p className="text-[12px] text-ink-muted">Uttar Pradesh, 403 seats. The seat is covered with circles Meta can target.</p>
    </div>
  );
}
