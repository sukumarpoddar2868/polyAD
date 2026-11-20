/**
 * Prompts, output schemas and clean-up for AI campaign setup.
 * Port of the root `llm_resolver.py`, extended so the AI also proposes the
 * campaign name, daily budget and call-to-action. Pure: no server-only.
 */
import { z } from "zod";
import { CURRENCY, type Currency, type PolyadDestination } from "../engine/presets.ts";
import type { CtaType } from "../engine/schema.ts";
import { ELECTION_RULES, LANGUAGE_INFO, candidateLines, type CandidateBrief, type CopyLanguage } from "./political.ts";

/* ---------- Locations ---------- */

export const REACH_SCOPES = ["hyper-local", "local", "city-wide", "metro"] as const;
export type ReachScope = (typeof REACH_SCOPES)[number];

export const SCOPE_INFO: Record<ReachScope, { label: string; blurb: string }> = {
  "hyper-local": { label: "Hyper-local", blurb: "Up to 3 neighbourhoods per city (big cities). Small towns: the whole town" },
  local: { label: "Local", blurb: "The town or city itself" },
  "city-wide": { label: "City-wide", blurb: "The city + 17 km around it" },
  metro: { label: "Metro", blurb: "The city + 40 km around it — regional brands" },
};

/**
 * One target area after lookup. `geo` = a Meta location id; null = a lat/lng circle.
 * lat/lng are null only for a Meta area the map couldn't place (it is still targeted by its id).
 */
export const Pin = z.object({
  name: z.string().min(1),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  radius_km: z.number().min(0).max(80),
  why: z.string().default(""),
  geo: z.object({ kind: z.enum(["city", "neighborhood", "subcity", "zip"]), key: z.string().min(1).max(40) }).nullable().default(null),
});
export type Pin = z.output<typeof Pin>;

/** What the AI returns: names only. Coordinates come from Meta / OpenStreetMap, never the model. */
export const LocationGuess = z.object({
  picks: z
    .array(
      z.object({
        area: z.string().trim().min(1).max(80),
        city: z.string().trim().min(1).max(80),
        state: z.string().trim().max(80).default(""),
        why: z.string().trim().max(300).default(""),
      }),
    )
    .min(1)
    .max(30),
});

export function locationPrompt(p: {
  cities: string[];
  businessName: string;
  about: string;
  country: string;
  scope: ReachScope;
}): string {
  return `You are choosing target areas for a Meta (Facebook + Instagram) ad campaign.

Cities the user entered:
${p.cities.map((c) => `  • ${c}`).join("\n")}

Business:
  Name:        ${p.businessName || "(not provided)"}
  Description: ${p.about || "(not provided)"}
  Country:     ${p.country}
  Reach scope: ${p.scope}

Return NAMES ONLY — never coordinates. Names are looked up on Meta's location
list and maps, so use the common, official spelling (e.g. "Koramangala",
"HSR Layout", "Andheri West", "Salt Lake").

For every entered city, give its official name in "city" and its state/province
in "state" (e.g. city "Bengaluru" or "Bangalore", state "Karnataka").

If reach scope is "hyper-local":
  → For each city return up to 3 well-known neighbourhoods / localities most
    likely to hold this business's customers, one pick each, with "area" = the
    neighbourhood name only (no city in it).
  → Only use real, widely known neighbourhood names. For a small town with no
    well-known neighbourhoods, return ONE pick with "area" = the town name.
  → "why": one short sentence naming the area and why it fits the business.

Otherwise ("local", "city-wide", "metro"):
  → ONE pick per city with "area" = the city name itself; "why" one sentence.

Return one JSON object:
{ "picks": [ { "area": "Koramangala", "city": "Bangalore", "state": "Karnataka", "why": "..." } ] }`;
}

export function expectedPins(cityCount: number, scope: ReachScope) {
  return scope === "hyper-local" ? cityCount * 3 : cityCount;
}

/* ---------- Ad copy + campaign basics ---------- */

export const AGE_MIN = 18;
export const AGE_MAX = 65;
export const GENDERS = ["any", "female", "male"] as const;
export const DEVICE_OS = ["all", "android", "ios"] as const;

export type CopySuggestion = {
  campaign_name: string;
  daily_budget: number;
  primary_text: string;
  headline: string;
  description: string | null;
  call_to_action: CtaType;
  interest_targeting: string[];
  age_min: number;
  age_max: number;
  gender: (typeof GENDERS)[number];
  device_os: (typeof DEVICE_OS)[number];
  /** One line on why this audience — shown to the user. */
  audience_why: string;
  /** Ideas for carousel cards (used if the user picks Carousel). */
  carousel_cards: CardIdea[];
  /** Instant form only: short qualifying questions + thank-you text. */
  lead_questions: string[];
  thank_you_message: string;
};

export type CardIdea = { headline: string; description: string };

/** Clean model card output: non-empty, ≤40-char headlines, unique. */
export function sanitizeCards(raw: unknown, max = 10): CardIdea[] {
  const seen = new Set<string>();
  const out: CardIdea[] = [];
  for (const c of Array.isArray(raw) ? raw : []) {
    const o = (c ?? {}) as Record<string, unknown>;
    const headline = squash(o.headline, 40);
    if (!headline || seen.has(headline.toLowerCase())) continue;
    seen.add(headline.toLowerCase());
    out.push({ headline, description: squash(o.description, 60) });
    if (out.length >= max) break;
  }
  return out;
}

/** Carousel cards on demand (Creative → "Write cards with AI"). */
export function cardsPrompt(p: {
  about: string;
  offer: string;
  destination: PolyadDestination;
  count: number;
  candidate: CandidateBrief;
  language: CopyLanguage;
}): string {
  return `Write ${p.count} carousel cards for a POLITICAL Meta (Facebook + Instagram) ad for an Indian election candidate.

${candidateLines(p.candidate)}
About the candidate: ${p.about || "(not provided)"}
What this ad says: ${p.offer || "(not provided)"}
Goal: ${politicalGoal(p.destination)}
Language: ${LANGUAGE_INFO[p.language].brief}

${ELECTION_RULES}
Each card is one swipeable panel with its own image. Make every card a DIFFERENT point:
the candidate, a local issue from the brief, a plan from the brief, the vote appeal.
Card 1 should hook; the last card should push the action.

STRICT RULES:
  • headline: MAXIMUM 32 characters, specific, no emojis.
  • description: MAXIMUM 50 characters, optional detail.
  • Exactly ${p.count} cards, no duplicates.

Return one JSON object:
{ "cards": [ { "headline": "...", "description": "..." } ] }`;
}

/** Sensible daily range for a local campaign, in major units. */
export const BUDGET_RANGE: Record<Currency, [number, number]> = { INR: [300, 3000], USD: [10, 100] };

/* ---------- Political ad copy ---------- */

/** What the reader should do next, for a candidate's campaign. */
export function politicalGoal(destination: PolyadDestination): string {
  switch (destination) {
    case "lead_form":
      return "SIGN-UPS — supporters and volunteers join the campaign via a short form inside Facebook/Instagram. Invite them to join the team; headline = the invitation.";
    case "website":
      return "VISITS to the campaign's web page — give a reason to read the candidate's plans; headline = what they will find.";
    case "messenger":
    case "instagram_dm":
      return "CHATS with the campaign Page — invite voters to share their local issues; headline = why message.";
    case "instagram_profile":
      return "PROFILE VISITS — invite voters to follow the candidate for updates; headline = what they will see.";
    case "call":
      return "PHONE CALLS to the campaign office — invite voters to call with their issues; headline = why call.";
    case "none":
      return "AWARENESS — make voters remember the candidate, the party, the seat and the symbol, and ask for their vote; headline = name + the core promise from the brief.";
  }
}

/** Ad copy + campaign basics for a candidate; audience fields are fixed in code, not asked. */
export function politicalCopyPrompt(p: {
  candidate: CandidateBrief;
  language: CopyLanguage;
  about: string;
  offer: string;
  currency: Currency;
  destination: PolyadDestination;
  ctas: readonly CtaType[];
  locationCount: number;
}): string {
  const [lo, hi] = BUDGET_RANGE[p.currency];
  return `You are writing a POLITICAL Meta (Facebook + Instagram) ad for an Indian election candidate.

${candidateLines(p.candidate)}

Brief from the campaign team — the ONLY facts you may use:
  About the candidate: ${p.about || "(not provided)"}
  What this ad should say: ${p.offer || "(not provided)"}

Goal: ${politicalGoal(p.destination)}
Language: ${LANGUAGE_INFO[p.language].brief}

${ELECTION_RULES}

FIELDS:
  • campaign_name: internal, English, MAXIMUM 40 characters, e.g. "Seat 174 — vote appeal Feb".
  • daily_budget: whole number in ${p.currency} between ${lo} and ${hi}; higher for more areas (${p.locationCount} here).
  • primary_text: 2–3 short sentences, MAXIMUM 400 characters, no line breaks. Mention the candidate's name; mention the party (and symbol if given) once. Don't write the seat number in voter text.
  • headline: MAXIMUM 35 characters.
  • description: MAXIMUM 100 characters, optional.
  • call_to_action: exactly one of ${p.ctas.join(", ")}.
  • lead_questions: ${p.destination === "lead_form" ? "1–2 short questions for volunteers (MAXIMUM 80 characters each), e.g. which ward/village they are from, how they can help. Never ask name, phone, email, city, religion or caste." : "[]"}
  • thank_you_message: ${p.destination === "lead_form" ? "one sentence after sign-up saying the team will contact them (MAXIMUM 120 characters)." : "\"\""}
  • carousel_cards: 4 cards, each a different point; headline MAXIMUM 32 characters, description MAXIMUM 50 characters.
  • interest_targeting: [] (political ads are not targeted by interests).
  • age_min 18, age_max 65, gender "any", device_os "all", audience_why "".

OUTPUT: one compact JSON object, no Markdown, no emojis, no line breaks inside strings:
{"campaign_name":"...","daily_budget":${lo},"primary_text":"...","headline":"...","description":"...","call_to_action":"${p.ctas[0]}","interest_targeting":[],"age_min":18,"age_max":65,"gender":"any","device_os":"all","audience_why":"","carousel_cards":[{"headline":"...","description":"..."}],"lead_questions":[],"thank_you_message":""}`;
}

/** Audience fields are never left to the model for political ads: all adult voters, no interests. */
export function politicalAudience(c: CopySuggestion): CopySuggestion {
  return { ...c, interest_targeting: [], age_min: AGE_MIN, age_max: AGE_MAX, gender: "any", device_os: "all", audience_why: "All voters (18+) in the chosen areas — political ads aren't narrowed by interests." };
}

const squash = (s: unknown, max: number): string => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  const cp = Array.from(t);
  return cp.length <= max ? t : cp.slice(0, max - 1).join("").trimEnd() + "…";
};

const int = (v: unknown, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : fallback;
};

/** Clamp/clean whatever the model returned into a usable suggestion. */
export function sanitizeCopy(
  raw: Record<string, unknown>,
  ctx: { currency: Currency; ctas: readonly CtaType[]; fallbackName: string },
): CopySuggestion | null {
  const primary = squash(raw.primary_text, 400);
  const headline = squash(raw.headline, 40);
  if (!primary || !headline) return null;

  const [lo, hi] = BUDGET_RANGE[ctx.currency];
  const budget = Math.min(hi, Math.max(lo, int(raw.daily_budget, CURRENCY[ctx.currency].defaultDailyBudget)));

  let ageMin = Math.min(AGE_MAX, Math.max(AGE_MIN, int(raw.age_min, 25)));
  let ageMax = Math.min(AGE_MAX, Math.max(AGE_MIN, int(raw.age_max, 55)));
  if (ageMax < ageMin) [ageMin, ageMax] = [ageMax, ageMin];

  const gender = String(raw.gender ?? "any").toLowerCase().trim();
  const cta = String(raw.call_to_action ?? "").toUpperCase().trim() as CtaType;
  const device = String(raw.device_os ?? "all").toLowerCase().trim();

  const seen = new Set<string>();
  const interests = (Array.isArray(raw.interest_targeting) ? raw.interest_targeting : [])
    .map((i) => squash(i, 60))
    .filter((i) => i && !seen.has(i.toLowerCase()) && seen.add(i.toLowerCase()))
    .slice(0, 5);

  return {
    campaign_name: squash(raw.campaign_name, 40) || ctx.fallbackName,
    daily_budget: budget,
    primary_text: primary,
    headline,
    description: squash(raw.description, 125) || null,
    call_to_action: ctx.ctas.includes(cta) ? cta : ctx.ctas[0],
    interest_targeting: interests,
    age_min: ageMin,
    age_max: ageMax,
    gender: (GENDERS as readonly string[]).includes(gender) ? (gender as CopySuggestion["gender"]) : "any",
    device_os: (DEVICE_OS as readonly string[]).includes(device) ? (device as CopySuggestion["device_os"]) : "all",
    audience_why: squash(raw.audience_why, 200),
    carousel_cards: sanitizeCards(raw.carousel_cards, 10),
    lead_questions: (Array.isArray(raw.lead_questions) ? raw.lead_questions : [])
      .map((q) => squash(q, 80))
      .filter((q) => q && !/\b(name|phone|e-?mail|city)\b/i.test(q))
      .slice(0, 3),
    thank_you_message: squash(raw.thank_you_message, 160),
  };
}

/** Deterministic copy if the model fails twice — the user is never stuck. */
export function fallbackCopy(p: {
  businessName: string;
  about: string;
  offer: string;
  currency: Currency;
  ctas: readonly CtaType[];
  fallbackName: string;
}): CopySuggestion {
  const seed = (p.offer || p.about || p.businessName).trim();
  return {
    campaign_name: p.fallbackName,
    daily_budget: CURRENCY[p.currency].defaultDailyBudget,
    primary_text: squash(seed, 400) || `Learn more about ${p.businessName || "us"}.`,
    headline: squash(seed.split(".")[0], 35) || squash(p.businessName, 35) || "Find out more",
    description: squash(p.about || p.businessName, 110) || null,
    call_to_action: p.ctas[0],
    interest_targeting: [],
    age_min: 25,
    age_max: 55,
    gender: "any",
    device_os: "all",
    audience_why: "",
    carousel_cards: [],
    lead_questions: [],
    thank_you_message: "",
  };
}
