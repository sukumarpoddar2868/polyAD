/**
 * ECI silence period (RPA 1951 s.126): no election ads in a constituency during
 * the 48 hours ending when polling closes there. Times are IST (UTC+5:30, no DST).
 * Pure — used at launch, on the schedule page and in tests.
 */

export type PollRow = { ac_no: number; phase: number | null; poll_date: string; poll_end: string };
export type Window = { acNo: number; start: Date; close: Date };

const HOUR = 3600 * 1000;
export const SILENCE_HOURS = 48;

/** "2027-02-20" + "18:00[:00]" (IST) → the silence window. */
export function silenceWindow(pollDate: string, pollEnd = "18:00"): { start: Date; close: Date } {
  const close = new Date(`${pollDate}T${pollEnd.slice(0, 5)}:00+05:30`);
  return { start: new Date(close.getTime() - SILENCE_HOURS * HOUR), close };
}

/** "20 Feb 2027, 6:00 pm" in IST. */
export function fmtIst(d: Date): string {
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Meta datetime in IST, e.g. "2027-02-18T18:00:00+05:30". */
export function metaIst(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * HOUR).toISOString().slice(0, 19);
  return `${ist}+05:30`;
}

export type SilenceCheck = {
  /** Seats whose silence period is on now (or covers the campaign start) — launch must stop. */
  blocked: Window[];
  /** End the campaign here so it never runs into a silence period. null = no cap needed. */
  capAt: Window | null;
  /** Targeted seats with no poll date entered yet — PolyAd can't protect them. */
  missing: number[];
};

/**
 * Check a campaign that targets `seats` and runs [start, end) against the poll
 * schedule. Windows already over are ignored.
 */
export function checkSilence(seats: number[], schedule: PollRow[], run: { now: Date; start?: Date | null; end?: Date | null }): SilenceCheck {
  const by = new Map(schedule.map((r) => [r.ac_no, r]));
  const begin = Math.max(run.now.getTime(), run.start?.getTime() ?? 0);
  const missing: number[] = [];
  const windows: Window[] = [];
  for (const no of [...new Set(seats)].sort((a, b) => a - b)) {
    const r = by.get(no);
    if (!r) {
      missing.push(no);
      continue;
    }
    const w = silenceWindow(r.poll_date, r.poll_end);
    if (w.close.getTime() > begin) windows.push({ acNo: no, ...w });
  }
  const blocked = windows.filter((w) => w.start.getTime() <= begin);
  if (blocked.length) return { blocked, capAt: null, missing };
  const first = windows.sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  const capAt = first && (!run.end || run.end.getTime() > first.start.getTime()) ? first : null;
  return { blocked: [], capAt, missing };
}
