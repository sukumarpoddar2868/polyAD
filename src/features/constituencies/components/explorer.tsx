"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/field";
import { Card, Chip } from "@/components/ui/surface";
import { cn } from "@/lib/cn";
import { seatShapeAction, type SeatShape } from "../actions";
import { searchSeats, type SeatSummary } from "../search";

const SeatMap = dynamic(() => import("./seat-map"), {
  ssr: false,
  loading: () => <div className="grid h-[480px] place-items-center rounded-card bg-lavender-soft text-[13px] text-ink-muted">Loading map…</div>,
});

const pct = (n: number) => `${Math.round(n * 100)}%`;
const label = (s: SeatSummary) => `${s.no} · ${s.name}${s.reserved ? ` (${s.reserved})` : ""}`;

export function ConstituencyExplorer({ seats, source }: { seats: SeatSummary[]; source: string }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<{ seat: SeatSummary; shape: SeatShape }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const results = useMemo(() => searchSeats(seats, q, 12), [seats, q]);

  const add = (seat: SeatSummary) => {
    setQ("");
    if (picked.some((p) => p.seat.no === seat.no)) return;
    start(async () => {
      const shape = await seatShapeAction({ no: seat.no });
      if (!shape) return setError("Couldn't load that seat.");
      setError(null);
      setPicked((p) => [...p, { seat, shape }]);
    });
  };

  const circles = picked.reduce((n, p) => n + p.shape.cover.circles.length, 0);
  const mapSeats = useMemo(() => picked.map((p) => ({ polygons: p.shape.polygons, bbox: p.shape.bbox, circles: p.shape.cover.circles })), [picked]);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-3">
          <label className="relative block">
            <span className="sr-only">Search constituencies</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Seat name, number, district or Lok Sabha seat" className="pl-9" />
          </label>
          {results.length > 0 && (
            <ul className="flex max-h-72 flex-col overflow-auto" role="listbox" aria-label="Matching seats">
              {results.map((s) => (
                <li key={s.no}>
                  <button
                    type="button"
                    onClick={() => add(s)}
                    className="w-full rounded-lg px-3 py-2 text-left hover:bg-lavender-soft"
                  >
                    <span className="block text-[14px] font-bold">{label(s)}</span>
                    <span className="block text-[12px] text-ink-muted">{s.district} district · {s.pc.name} Lok Sabha</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {q && !results.length && <p className="text-[13px] text-ink-muted">No seat matches “{q}”.</p>}
          {pending && <p className="text-[13px] text-ink-muted">Working out the targeting…</p>}
          {error && <p className="text-[13px] font-bold text-tomato-700">{error}</p>}
        </Card>

        {picked.map(({ seat, shape: { cover } }) => (
          <Card key={seat.no} className="flex flex-col gap-2 p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-extrabold">{label(seat)}</p>
                <p className="text-[12px] text-ink-muted">{seat.district} · {seat.pc.name} Lok Sabha</p>
              </div>
              <button
                type="button"
                onClick={() => setPicked((p) => p.filter((x) => x.seat.no !== seat.no))}
                className="rounded-full p-1 text-ink-muted hover:bg-lavender-soft hover:text-ink"
                aria-label={`Remove ${seat.name}`}
              >
                <X className="size-4" />
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
              <dt className="text-ink-muted">Area</dt><dd className="font-bold">{cover.areaKm2.toLocaleString("en-IN")} km²</dd>
              <dt className="text-ink-muted">Meta circles</dt><dd className="font-bold">{cover.circles.length} × {cover.radiusKm} km</dd>
              <dt className="text-ink-muted">Seat covered</dt><dd className="font-bold">{pct(cover.coverage)}</dd>
              <dt className="text-ink-muted">Outside seat</dt><dd className={cn("font-bold", cover.spill > 0.3 && "text-tomato-700")}>{pct(cover.spill)}</dd>
            </dl>
          </Card>
        ))}

        {picked.length > 1 && (
          <div className="flex items-center gap-2 text-[13px]">
            <Chip tone={circles > 200 ? "stopped" : "neutral"}>{circles} circles</Chip>
            <span className="text-ink-muted">{circles > 200 ? "Over Meta's 200-location limit — split into more campaigns." : "Meta allows up to 200 per ad set."}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <SeatMap seats={mapSeats} />
        <p className="text-[12px] text-ink-muted">
          Black line = constituency boundary · tinted circles = what Meta will target. Meta only targets circles, so a little
          spills over the edge. Boundaries: {source}
        </p>
      </div>
    </div>
  );
}
