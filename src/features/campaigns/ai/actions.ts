"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import { getClient } from "@/features/clients/data";
import { aiConfigured } from "@/lib/env";
import { getConnectionToken } from "@/features/meta-connect/store";
import { COUNTRY_TO_ISO, CTA_FOR, CURRENCIES, CURRENCY_TO_COUNTRY, DESTINATIONS } from "../engine/presets.ts";
import { resolveTyped } from "../geo/resolve.ts";
import { REACH_SCOPES, expectedPins, type CardIdea, type CopySuggestion, type Pin } from "./prompts.ts";
import { generateCards, generatePoliticalCopy, resolveLocations } from "./resolver.ts";
import { COPY_LANGUAGES, type CandidateBrief, type GuardrailHit } from "./political.ts";
import { partyLabel } from "@/features/clients/political";
import { getSeat, seatCover } from "@/features/constituencies/seats";
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
const OBJECTIVES_LIVE = ["OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_SALES"] as const;

const SetupInput = z.object({
  clientId: z.number().int().positive(),
  objective: z.enum(OBJECTIVES_LIVE),
  destination: z.enum(DESTINATIONS),
  businessName: text(120).min(1, "Add the business name."),
  website: z.union([z.literal(""), z.url("Enter a full website address, starting with https://")]),
  about: text(2000).min(20, "Describe the candidate in a sentence or two."),
  offer: text(2000).min(10, "Say what this ad should tell voters."),
  cities: z.array(text(80).min(1)).max(10),
  language: z.enum(COPY_LANGUAGES),
  scope: z.enum(REACH_SCOPES),
  currency: z.enum(CURRENCIES),
});
export type SetupInput = z.input<typeof SetupInput>;

export type SetupResult =
  | {
      ok: true;
      pins: Pin[];
      /** The candidate's whole seat as Meta circles (when no cities were typed). */
      seat: { no: number; name: string; coverage: number; pins: Pin[] } | null;
      notes: string[];
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
  const country = CURRENCY_TO_COUNTRY[d.currency];
  const candidate = candidateBrief(client, d.businessName);
  if (!d.cities.length && !client.ac_no) {
    return { ok: false, error: "Add target cities, or set the candidate's constituency on their profile.", fieldErrors: { cities: "Add at least one city." } };
  }
  // No cities typed → the candidate's own seat, covered with circles Meta can target.
  const cover = !d.cities.length && client.ac_no ? seatCover(client.ac_no) : null;
  const seat =
    cover && candidate.seat
      ? {
          no: candidate.seat.no,
          name: candidate.seat.name,
          coverage: cover.coverage,
          pins: cover.circles.map((c, i) => ({ name: `${candidate.seat!.name} ${i + 1}`, lat: c.lat, lng: c.lng, radius_km: c.radiusKm, why: "", geo: null })),
        }
      : null;
  const token = client.meta_connection_id ? await getConnectionToken(user.id, client.meta_connection_id) : null;
  try {
    const [{ pins, notes }, { copy, fallback, flags }] = await Promise.all([
      d.cities.length
        ? resolveLocations({
            cities: d.cities,
            businessName: candidate.name,
            about: d.about,
            country,
            countryIso: COUNTRY_TO_ISO[country] ?? "IN",
            scope: d.scope,
            token,
          })
        : Promise.resolve({ pins: [] as Pin[], notes: [] as string[] }),
      generatePoliticalCopy({
        candidate,
        language: d.language,
        about: d.about,
        offer: d.offer,
        currency: d.currency,
        destination,
        ctas: CTA_FOR[destination],
        locationCount: seat ? seat.pins.length : expectedPins(d.cities.length, d.scope),
        fallbackName: `${candidate.name} — ${d.objective.replace("OUTCOME_", "").toLowerCase()}`.slice(0, 40),
      }),
    ]);
    return { ok: true, pins, seat, notes, copy, usedFallback: fallback, flags };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI setup failed. Please try again." };
  }
}

const AreaInput = z.object({
  clientId: z.number().int().positive(),
  city: text(120).min(1),
  scope: z.enum(REACH_SCOPES),
  businessName: text(120),
  about: text(2000),
  currency: z.enum(CURRENCIES),
});

/** Audience step: add an area by name, "Area, City" or PIN code — direct lookup, no AI. */
export async function resolveAreaAction(input: z.input<typeof AreaInput>): Promise<{ ok: true; pins: Pin[]; notes: string[] } | { ok: false; error: string }> {
  const user = await requireUser();
  const parsed = AreaInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Type a city, \"Area, City\" or a PIN code." };
  const d = parsed.data;
  const client = await getClient(user.id, d.clientId);
  if (!client) return { ok: false, error: "Client not found." };
  const token = client.meta_connection_id ? await getConnectionToken(user.id, client.meta_connection_id) : null;
  const country = COUNTRY_TO_ISO[CURRENCY_TO_COUNTRY[d.currency]] ?? "IN";
  try {
    const r = await resolveTyped(token, d.city, d.scope, country);
    if (!r.areas.length) return { ok: false, error: r.notes[0] ?? "Couldn't find that area." };
    return { ok: true, pins: r.areas, notes: r.notes };
  } catch (e) {
    // Map search outage: say so instead of failing the whole action.
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't look up that area. Please try again." };
  }
}

const CardsInput = z.object({
  clientId: z.number().int().positive(),
  businessName: text(120),
  about: text(2000),
  offer: text(2000),
  destination: z.enum(DESTINATIONS),
  objective: z.enum(OBJECTIVES_LIVE).optional(),
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
    return { ok: true, cards: await generateCards({ ...d, political: { candidate: candidateBrief(client, d.businessName), language: d.language } }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "AI failed. Please try again." };
  }
}
