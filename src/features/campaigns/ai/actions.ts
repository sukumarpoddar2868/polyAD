"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import { getClient } from "@/features/clients/data";
import { aiConfigured } from "@/lib/env";
import { CTA_FOR, POLYAD_DESTINATIONS, POLYAD_OBJECTIVES } from "../engine/presets.ts";
import type { CardIdea, CopySuggestion, Pin } from "./prompts.ts";
import { generateCards, generatePoliticalCopy } from "./resolver.ts";
import { COPY_LANGUAGES, type CandidateBrief, type GuardrailHit } from "./political.ts";
import { partyLabel } from "@/features/clients/political";
import { getSeat, seatCover } from "@/features/constituencies/seats";
import { MAX_SEATS } from "@/features/constituencies/search";
import type { ClientRow } from "@/lib/supabase/types";

/** The candidate as the AI sees it — from the saved profile, never typed per campaign. */
function candidateBrief(c: Pick<ClientRow, "candidate_name" | "business_name" | "party" | "symbol" | "ac_no">, typedName: string): CandidateBrief {
  const seat = c.ac_no ? getSeat(c.ac_no) : null;
  return {
    name: c.candidate_name?.trim() || typedName || c.business_name || "",
    party: partyLabel(c.party),
    symbol: c.symbol?.trim() || null,
    seat: seat ? { no: seat.no, name: seat.name, district: seat.district } : null,
  };
}

const text = (max: number) => z.string().trim().max(max);

const SetupInput = z.object({
  clientId: z.number().int().positive(),
  objective: z.enum(POLYAD_OBJECTIVES),
  destination: z.enum(POLYAD_DESTINATIONS),
  businessName: text(120).min(1, "Add the business name."),
  website: z.union([z.literal(""), z.url("Enter a full website address, starting with https://")]),
  about: text(2000).min(20, "Describe the candidate in a sentence or two."),
  offer: text(2000).min(10, "Say what this ad should tell voters."),
  seats: z.array(z.number().int().min(1).max(403)).min(1, "Choose at least one constituency.").max(MAX_SEATS, `At most ${MAX_SEATS} constituencies per campaign.`),
  language: z.enum(COPY_LANGUAGES),
});
export type SetupInput = z.input<typeof SetupInput>;

export type SetupResult =
  | {
      ok: true;
      /** Each chosen seat as Meta circles. */
      seats: { no: number; name: string; coverage: number; pins: Pin[] }[];
      copy: CopySuggestion;
      usedFallback: boolean;
      /** Election-rule words the AI couldn't avoid — shown to the team. */
      flags: GuardrailHit[];
    }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Setup step: one call drafts the whole campaign for the user to review. */
export async function generateSetupAction(input: SetupInput): Promise<SetupResult> {
  const user = await requireUser();
  const parsed = SetupInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  const d = parsed.data;
  if (d.destination === "website" && !d.website) {
    return { ok: false, error: "This goal sends people to a website.", fieldErrors: { website: "Add the website page people should visit." } };
  }
  const client = await getClient(user.id, d.clientId);
  if (!client) return { ok: false, error: "Client not found." };
  if (!aiConfigured()) return { ok: false, error: "AI setup isn't configured on this server yet." };

  const destination = d.destination;
  const candidate = candidateBrief(client, d.businessName);
  // Each seat → circles Meta can target, sharing Meta's 200 locations per ad set.
  const unique = [...new Set(d.seats)];
  const perSeat = Math.min(40, Math.floor(200 / unique.length));
  const seats = [];
  for (const no of unique) {
    const seat = getSeat(no);
    const cover = seatCover(no, perSeat);
    if (!seat || !cover) return { ok: false, error: `Constituency ${no} not found.`, fieldErrors: { seats: "Check the constituencies." } };
    seats.push({
      no,
      name: seat.name,
      coverage: cover.coverage,
      pins: cover.circles.map((c, i) => ({ name: `${seat.name} ${i + 1}`, lat: c.lat, lng: c.lng, radius_km: c.radiusKm, why: "", geo: null })),
    });
  }
  try {
    const { copy, fallback, flags } = await generatePoliticalCopy({
      candidate,
      language: d.language,
      about: d.about,
      offer: d.offer,
      currency: "INR",
      destination,
      ctas: CTA_FOR[destination],
      locationCount: seats.reduce((n, s) => n + s.pins.length, 0),
      fallbackName: `${candidate.name} — ${d.objective.replace("OUTCOME_", "").toLowerCase()}`.slice(0, 40),
    });
    return { ok: true, seats, copy, usedFallback: fallback, flags };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI setup failed. Please try again." };
  }
}

const CardsInput = z.object({
  clientId: z.number().int().positive(),
  businessName: text(120),
  about: text(2000),
  offer: text(2000),
  destination: z.enum(POLYAD_DESTINATIONS),
  objective: z.enum(POLYAD_OBJECTIVES).optional(),
  count: z.number().int().min(2).max(10),
  language: z.enum(COPY_LANGUAGES).default("hi"),
});

/** Creative step: AI writes a headline + description for each carousel card. */
export async function generateCardsAction(input: z.input<typeof CardsInput>): Promise<{ ok: true; cards: CardIdea[] } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = CardsInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Fill in the business details in Start first." };
  const d = parsed.data;
  if (!d.about && !d.offer) return { ok: false, error: "Describe the candidate and the message in Start first." };
  const client = await getClient(user.id, d.clientId);
  if (!client) return { ok: false, error: "Candidate not found." };
  if (!aiConfigured()) return { ok: false, error: "AI isn't configured on this server yet." };
  try {
    return { ok: true, cards: await generateCards({ ...d, candidate: candidateBrief(client, d.businessName) }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI failed. Please try again." };
  }
}
