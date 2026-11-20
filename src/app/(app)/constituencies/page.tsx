import type { Metadata } from "next";
import { requireUser } from "@/features/auth/dal";
import { ConstituencyExplorer } from "@/features/constituencies/components/explorer";
import { SOURCE, STATE, seatSummaries } from "@/features/constituencies/seats";

export const metadata: Metadata = { title: "Constituencies" };

export default async function ConstituenciesPage() {
  await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-[13px] font-bold uppercase tracking-wide text-ink-muted">{STATE} · 403 Assembly seats</p>
        <h1 className="mt-1 text-[32px] font-extrabold leading-tight">constituencies</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-ink-muted">
          Pick a seat to see how PolyAd turns its boundary into Meta location targeting.
        </p>
      </header>
      <ConstituencyExplorer seats={seatSummaries()} source={SOURCE} />
    </div>
  );
}
