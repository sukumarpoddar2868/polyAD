"use client";

import { useEffect, useState } from "react";
import { Landmark, X } from "lucide-react";
import { Input } from "@/components/ui/field";
import { findSeatsAction } from "../actions";
import { MAX_SEATS, type SeatSummary } from "../search";

export type SeatRef = { no: number; name: string };

/** Choose Assembly constituencies to target (chips + search). */
export function SeatChooser({ id, value, onChange, suggest }: { id: string; value: SeatRef[]; onChange: (v: SeatRef[]) => void; suggest?: SeatRef | null }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SeatSummary[]>([]);

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

  const full = value.length >= MAX_SEATS;
  const add = (s: SeatRef) => {
    setQ("");
    setHits([]);
    if (!full && !value.some((v) => v.no === s.no)) onChange([...value, { no: s.no, name: s.name }]);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {value.map((s) => (
            <li key={s.no} className="flex items-center gap-1.5 rounded-pill bg-lavender-soft py-1.5 pl-3 pr-1.5 text-[14px] font-bold">
              <Landmark className="size-4 text-lavender-deep" aria-hidden />
              {s.no} · {s.name}
              <button type="button" onClick={() => onChange(value.filter((v) => v.no !== s.no))} aria-label={`Remove ${s.name}`} className="rounded-full p-1 hover:bg-lavender">
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {suggest && !value.some((v) => v.no === suggest.no) && !full && (
        <button type="button" onClick={() => add(suggest)} className="flex w-fit items-center gap-2 rounded-pill border border-lavender px-4 py-2 text-[14px] font-bold hover:bg-lavender-soft">
          <Landmark className="size-4 text-lavender-deep" aria-hidden /> Add the candidate&apos;s seat: {suggest.no} · {suggest.name}
        </button>
      )}
      {!full && (
        <Input id={id} value={q} placeholder="Search: Lucknow Central · 174 · Gorakhpur" onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      )}
      {q.trim() !== "" && hits.length > 0 && (
        <ul className="flex flex-col rounded-card bg-paper p-1 shadow-md" role="listbox" aria-label="Matching constituencies">
          {hits.map((s) => (
            <li key={s.no}>
              <button type="button" onClick={() => add(s)} className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-lavender-soft">
                <Landmark className="mt-0.5 size-4 shrink-0 text-lavender-deep" aria-hidden />
                <span>
                  <span className="block text-[14px] font-bold">
                    {s.no} · {s.name}
                    {s.reserved ? ` (${s.reserved})` : ""}
                  </span>
                  <span className="block text-[12px] text-ink-muted">
                    {s.district} · {s.pc.name} Lok Sabha
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
