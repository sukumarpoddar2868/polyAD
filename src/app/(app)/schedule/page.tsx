import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Chip } from "@/components/ui/surface";
import { requireUser } from "@/features/auth/dal";
import { clearScheduleAction } from "@/features/compliance/actions";
import { ScheduleForm } from "@/features/compliance/components/schedule-form";
import { listSchedule } from "@/features/compliance/data";
import { fmtIst, silenceWindow } from "@/features/compliance/silence";
import { getSeat, seatSummaries } from "@/features/constituencies/seats";

export const metadata: Metadata = { title: "Poll schedule" };

export default async function SchedulePage() {
  const user = await requireUser();
  const rows = await listSchedule(user.id);
  const districts = [...new Set(seatSummaries().map((s) => s.district))].sort();

  // One group per poll date + close time (+ phase).
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.poll_date}|${r.poll_end}|${r.phase ?? ""}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const sorted = [...groups.values()].sort((a, b) => a[0].poll_date.localeCompare(b[0].poll_date));
  // eslint-disable-next-line react-hooks/purity -- server render: "now" decides which windows are past
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[13px] font-bold uppercase tracking-wide text-ink-muted">Uttar Pradesh · {rows.length} of 403 seats scheduled</p>
        <h1 className="mt-1 text-[32px] font-extrabold leading-tight">Poll schedule</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
          Enter each phase&apos;s poll date from the ECI schedule. No election ads may run in a seat during the 48 hours before polling closes there — PolyAd blocks launches in that window and ends campaigns before it starts.
        </p>
      </header>

      <Card>
        <h2 className="mb-4 text-[19px] font-extrabold">Add a poll date</h2>
        <ScheduleForm districts={districts} />
      </Card>

      {sorted.length > 0 && (
        <Card className="flex flex-col gap-4">
          <h2 className="text-[19px] font-extrabold">Scheduled</h2>
          {sorted.map((g) => {
            const r = g[0];
            const w = silenceWindow(r.poll_date, r.poll_end);
            const state = now >= w.close.getTime() ? "over" : now >= w.start.getTime() ? "silence" : "upcoming";
            const nos = g.map((x) => x.ac_no);
            return (
              <div key={`${r.poll_date}${r.poll_end}${r.phase}`} className="rounded-[10px] bg-lavender-soft p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[16px] font-extrabold">
                      {r.phase ? `Phase ${r.phase} · ` : ""}
                      {fmtIst(w.close).replace(/,? \d+:\d+.*$/, "")} · {g.length} seat{g.length === 1 ? "" : "s"}
                    </p>
                    <p className="text-[13px] text-ink-muted">
                      Silence: {fmtIst(w.start)} → {fmtIst(w.close)} IST
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Chip tone={state === "silence" ? "stopped" : state === "over" ? "neutral" : "paused"}>
                      {state === "silence" ? "Silence period now" : state === "over" ? "Polled" : "Upcoming"}
                    </Chip>
                    <form action={clearScheduleAction.bind(null, nos)}>
                      <Button variant="danger" size="sm" type="submit" aria-label="Remove this date">
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </form>
                  </div>
                </div>
                <details className="mt-2 text-[13px]">
                  <summary className="cursor-pointer font-bold">Seats</summary>
                  <p className="mt-1 text-ink-muted">{nos.map((n) => `${n} ${getSeat(n)?.name ?? ""}`).join(" · ")}</p>
                </details>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
