/**
 * Create-campaign blueprint: the Meta structure we mirror, and the draft
 * state the page holds. Each module is built out deeply later; `planned`
 * lists what each one will grow into.
 */
import { CTA_FOR, CURRENCY, POLYAD_DESTINATIONS, POLYAD_OBJECTIVES, type Currency } from "../engine/presets.ts";
import type { CtaType } from "../engine/schema.ts";
import type { CopyLanguage } from "../ai/political.ts";
import type { MediaRef } from "../media/rules";

export type SectionId = "start" | "name-budget" | "audience" | "placements" | "creative" | "review";

export type Level = { id: "start" | "campaign" | "adset" | "ad" | "review"; label: string; sections: { id: SectionId; label: string }[] };

/** Meta's order: start (business + objective) → Campaign → Ad set → Ad → review. */
export const LEVELS: Level[] = [
  { id: "start", label: "Start", sections: [{ id: "start", label: "Business & goal" }] },
  { id: "campaign", label: "Campaign", sections: [{ id: "name-budget", label: "Name & budget" }] },
  { id: "adset", label: "Ad set", sections: [{ id: "audience", label: "Audience" }, { id: "placements", label: "Placements" }] },
  { id: "ad", label: "Ad", sections: [{ id: "creative", label: "Creative" }] },
  { id: "review", label: "Review", sections: [{ id: "review", label: "Review & launch" }] },
];

export const SECTION_ORDER: SectionId[] = LEVELS.flatMap((l) => l.sections.map((s) => s.id));

export type ObjectiveId = (typeof POLYAD_OBJECTIVES)[number];

/** Where people go after tapping. The engine also knows WhatsApp; PolyAd doesn't offer it. */
export type Destination = (typeof POLYAD_DESTINATIONS)[number];

export const OBJECTIVE_OPTIONS: {
  id: ObjectiveId;
  label: string;
  blurb: string;
  available: boolean;
  note?: string;
}[] = [
  { id: "OUTCOME_AWARENESS", label: "Awareness", blurb: "Show the candidate's message to as many voters in the seat as possible.", available: true },
  { id: "OUTCOME_LEADS", label: "Sign-ups", blurb: "Collect volunteer or supporter sign-ups with an instant form, or get phone calls.", available: true },
  { id: "OUTCOME_ENGAGEMENT", label: "Engagement", blurb: "Get voters messaging the candidate on Messenger or Instagram.", available: true },
  { id: "OUTCOME_TRAFFIC", label: "Traffic", blurb: "Send people to the candidate's website or manifesto page.", available: true },
];

export type AdFormat = "single" | "carousel" | "video";
/** One carousel card (1:1 image). */
export type DraftCard = { id: string; headline: string; description: string; link: string; image?: MediaRef };

/** Uploaded media for single-image (feed/portrait/story) and video ads. */
export type DraftMedia = { feed?: MediaRef; portrait?: MediaRef; story?: MediaRef; video?: MediaRef };
export const CAROUSEL_MIN = 2;
export const CAROUSEL_MAX = 10;

/** Headline is valid when present and within Meta's 40 characters. */
export const cardReady = (c: DraftCard) => c.headline.trim() !== "" && c.headline.length <= 40;

/** Required media per format: feed image · every card image · the video. */
export function mediaReady(d: Draft): boolean {
  if (d.ad.format === "video") return Boolean(d.ad.media.video);
  if (d.ad.format === "carousel") return d.ad.carousel.cards.length > 0 && d.ad.carousel.cards.every((c) => c.image);
  return Boolean(d.ad.media.feed);
}

/** Instant form (destination lead_form). Contact fields are pre-filled by Meta. */
export type DraftLeadForm = { name: string; privacyUrl: string; fields: ContactField[]; questions: string[]; thankYou: string };
export const CONTACT_FIELDS = {
  FULL_NAME: "Full name",
  PHONE_NUMBER: "Phone number",
  EMAIL: "Email",
  CITY: "City",
  POST_CODE: "PIN / ZIP code",
  STATE: "State",
  GENDER: "Gender",
  DOB: "Date of birth",
} as const;
export type ContactField = keyof typeof CONTACT_FIELDS;
export const MAX_FORM_QUESTIONS = 5;
export const isHttpsUrl = (u: string) => /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(u.trim());

export function leadFormReady(d: Draft): boolean {
  if (d.ad.destination !== "lead_form") return true;
  const f = d.ad.leadForm;
  return isHttpsUrl(f.privacyUrl) && f.fields.length > 0 && f.questions.every((q) => q.trim().length > 0 && q.length <= 80);
}

/** Destination-specific details are filled in. */
export function destinationReady(d: Draft): boolean {
  switch (d.ad.destination) {
    case "website":
      return isHttpsUrl(d.ad.url);
    case "call":
      return isPhone(d.ad.phone);
    default:
      return true;
  }
}

export type AudienceType = "core" | "custom" | "lookalike";
export type SelectedAudience = { id: string; name: string; kind: string };

/** Custom/lookalike need at least one matching audience picked. */
export function audienceReady(d: Draft): boolean {
  const a = d.audience;
  if (a.type === "custom") return a.include.some((x) => x.kind !== "lookalike");
  if (a.type === "lookalike") return a.include.some((x) => x.kind === "lookalike");
  return true;
}

export type DeviceOs = "all" | "android" | "ios";
export const DEVICE_LABELS: Record<DeviceOs, string> = { all: "All phones", android: "Android", ios: "iPhone" };

/** A target circle. AI-made pins carry a one-line reason. */
/** A Meta location id. With it Meta targets its own area; lat/lng are only for the map. */
export type GeoRef = { kind: "city" | "neighborhood" | "subcity" | "zip"; key: string };
/**
 * One target area: a Meta id (`geo`) or a circle around lat/lng (`geo` null).
 * - lat/lng are null only for a Meta area the map couldn't place; it is still targeted by its id.
 * - `origin`: the Meta area this circle was tightened from, so it can be switched back.
 * - `seat`: the Assembly constituency this circle is part of (shown and removed as one group).
 */
export type DraftPin = { name: string; lat: number | null; lng: number | null; radiusKm: number; why: string; geo?: GeoRef | null; origin?: GeoRef | null; seat?: SeatTag | null };
export type SeatTag = { no: number; name: string; coverage: number };
export type PlacedPin = DraftPin & { lat: number; lng: number };
export const isPlaced = (p: DraftPin): p is PlacedPin => p.lat !== null && p.lng !== null;

/**
 * Areas as the server expects them. A Meta area without a map position sends 0,0:
 * Meta reads only its id. A circle always has a position.
 */
export const payloadPins = (pins: DraftPin[]) =>
  pins.filter((p) => p.geo || isPlaced(p)).map((p) => ({ lat: p.lat ?? 0, lng: p.lng ?? 0, radiusKm: p.radiusKm, geo: p.geo ?? null }));

export type DestinationOption = { id: Destination; label: string; blurb: string; available: boolean; note?: string };

/** What the client has connected — some destinations need it. */
type ClientCaps = { hasInstagram?: boolean } | undefined;

/** Destinations per objective, with availability for this client. */
export function destinationOptions(objective: ObjectiveId, client: ClientCaps): DestinationOption[] {
  const ig = client?.hasInstagram ? {} : { available: false, note: "Needs Instagram" };
  const opt = (id: Destination, label: string, blurb: string, extra: Partial<DestinationOption> = {}): DestinationOption => ({ id, label, blurb, available: true, ...extra });
  switch (objective) {
    case "OUTCOME_LEADS":
      return [
        opt("lead_form", "Instant form", "A quick sign-up form inside Facebook/Instagram — name and phone are pre-filled."),
        opt("call", "Phone call", "People tap to call the campaign office. Mobile only."),
      ];
    case "OUTCOME_TRAFFIC":
      return [
        opt("website", "Website", "Send people to a page on your website."),
        opt("instagram_profile", "Instagram profile", "Get profile visits and followers. Runs on Instagram only.", ig),
      ];
    case "OUTCOME_AWARENESS":
      return [opt("none", "Reach voters", "No click goal — Meta shows the ad to as many people in the chosen areas as possible.")];
    case "OUTCOME_ENGAGEMENT":
      return [
        opt("messenger", "Messenger", "Start chats with your Facebook Page."),
        opt("instagram_dm", "Instagram Direct", "Start DMs with your Instagram account.", ig),
      ];
  }
}

export const defaultDestination = (objective: ObjectiveId): Destination =>
  (({ OUTCOME_LEADS: "lead_form", OUTCOME_TRAFFIC: "website", OUTCOME_AWARENESS: "none", OUTCOME_ENGAGEMENT: "messenger" }) satisfies Record<ObjectiveId, Destination>)[objective];

export const DESTINATION_LABELS: Record<Destination, string> = {
  website: "Website",
  lead_form: "Instant form",
  call: "Phone call",
  messenger: "Messenger chat",
  instagram_dm: "Instagram Direct",
  instagram_profile: "Instagram profile",
  none: "Reach (no click goal)",
};

/** Default button for a destination (website depends on the goal). */
export function defaultCta(objective: ObjectiveId, destination: Destination): CtaType {
  if (destination === "website") return objective === "OUTCOME_LEADS" ? "SIGN_UP" : "LEARN_MORE";
  if (destination === "lead_form") return "SIGN_UP";
  return CTA_FOR[destination][0];
}

/** International phone number, digits only with a leading +. */
export const cleanPhone = (p: string) => p.replace(/[^\d+]/g, "");
export const isPhone = (p: string) => /^\+[1-9]\d{7,14}$/.test(cleanPhone(p));

export type Draft = {
  objective: ObjectiveId | null;
  clientId: number | null;
  /** What the user tells the AI (Setup step). */
  setup: {
    businessName: string;
    website: string;
    about: string;
    offer: string;
    /** Assembly constituencies to target (the AI covers each with circles). */
    seats: { no: number; name: string }[];
    /** Language the AI writes the ad text in. */
    language: CopyLanguage;
  };
  /** True once the AI has filled the campaign; every field stays editable. */
  generated: boolean;
  /** Set after a successful live launch (prevents launching twice). */
  launched: { campaignId: string; adsManagerUrl: string | null; active?: boolean } | null;
  campaign: {
    name: string;
    budgetType: "daily" | "lifetime";
    amount: string;
    currency: Currency;
    startDate: string;
    endDate: string;
    /** Awareness only: max times one person sees the ad per 7 days. */
    frequencyCap: number;
  };
  audience: {
    locations: DraftPin[];
    ageMin: number;
    ageMax: number;
    gender: "any" | "female" | "male";
    language: string;
    interests: string[];
    mode: "strict" | "advantage";
    /** Phone type. Anything but "all" forces manual placements (Meta rule). */
    device: DeviceOs;
    /** AI's one-line reason for the age/gender/phone choice. */
    why: string;
    /** Core = location/age/gender/interests (default). Custom / lookalike add Meta audiences on top. */
    type: AudienceType;
    include: SelectedAudience[];
    /** Excluded audiences (e.g. existing customers) — any type. */
    exclude: SelectedAudience[];
  };
  placements: {
    mode: "advantage" | "manual";
    facebook: boolean;
    instagram: boolean;
  };
  ad: {
    destination: Destination;
    url: string;
    /** Call ads: number with country code. */
    phone: string;
    primaryText: string;
    headline: string;
    description: string;
    cta: CtaType;
    format: AdFormat;
    media: DraftMedia;
    leadForm: DraftLeadForm;
    /** AI card ideas from Start, used when switching to carousel. */
    cardIdeas: { headline: string; description: string }[];
    carousel: { cards: DraftCard[]; optimizeOrder: boolean; endCard: boolean };
    /** Creative has AI-made / digitally altered realistic people or events (Meta disclosure). */
    digitallyCreated: boolean;
    /** The team checked text the election-rule check flagged, and it's fine. */
    copyReviewed: boolean;
    /** The MCMC pre-certification that covers this ad (ECI). Required to launch. */
    mcmcCertificateId: number | null;
  };
};

export const initialDraft = (client: { id: number; name: string } | null): Draft => ({
  objective: null,
  clientId: client?.id ?? null,
  setup: { businessName: client?.name ?? "", website: "", about: "", offer: "", seats: [], language: "hi" },
  generated: false,
  launched: null,
  campaign: { name: "", budgetType: "daily", amount: String(CURRENCY.INR.defaultDailyBudget), currency: "INR", startDate: "", endDate: "", frequencyCap: 2 },
  audience: { locations: [], ageMin: 18, ageMax: 65, gender: "any", language: "All languages", interests: [], mode: "strict", device: "all", why: "", type: "core", include: [], exclude: [] },
  placements: { mode: "advantage", facebook: true, instagram: true },
  ad: { destination: "lead_form", url: "", phone: "", primaryText: "", headline: "", description: "", cta: "SIGN_UP", format: "single", media: {}, leadForm: { name: "", privacyUrl: "", fields: ["FULL_NAME", "PHONE_NUMBER", "EMAIL"], questions: [], thankYou: "Thank you! Our team will contact you soon." }, cardIdeas: [], carousel: { cards: [], optimizeOrder: true, endCard: false }, digitallyCreated: false, copyReviewed: false, mcmcCertificateId: null },
});

/**
 * Fill any missing fields from the defaults. Protects against drafts created
 * before a field existed (e.g. state kept across a dev hot-reload).
 */
export function normalizeDraft(d: Draft): Draft {
  const base = initialDraft(null);
  const out: Draft = {
    ...base,
    ...d,
    setup: { ...base.setup, ...d.setup },
    campaign: { ...base.campaign, ...d.campaign },
    audience: { ...base.audience, ...d.audience },
    placements: { ...base.placements, ...d.placements },
    ad: {
      ...base.ad,
      ...d.ad,
      media: { ...base.ad.media, ...d.ad?.media },
      leadForm: { ...base.ad.leadForm, ...d.ad?.leadForm },
      carousel: { ...base.ad.carousel, ...d.ad?.carousel },
    },
  };
  // Drafts saved before WhatsApp/Sales were removed fall back to a supported goal.
  if ((out.objective as string) === "OUTCOME_SALES") out.objective = "OUTCOME_TRAFFIC";
  if ((out.ad.destination as string) === "whatsapp") out.ad = { ...out.ad, destination: out.objective ? defaultDestination(out.objective) : "lead_form" };
  // Keep the button valid for the destination (lists can change between versions).
  // PolyAd targets constituencies only: older drafts drop city/pin areas.
  out.audience = { ...out.audience, locations: out.audience.locations.filter((p) => p.seat) };
  if (out.objective && !CTA_FOR[out.ad.destination].includes(out.ad.cta)) out.ad = { ...out.ad, cta: defaultCta(out.objective, out.ad.destination) };
  return out;
}

/** Section is "done" enough to show a tick in the rail. */
export function sectionComplete(id: SectionId, d: Draft): boolean {
  switch (id) {
    case "start":
      return d.generated;
    case "name-budget":
      return d.campaign.name.trim() !== "" && Number(d.campaign.amount) > 0;
    case "audience":
      return d.audience.locations.length > 0 && audienceReady(d);
    case "placements":
      return d.placements.mode === "advantage" || d.placements.facebook || d.placements.instagram;
    case "creative":
      return (
        d.ad.primaryText.trim() !== "" &&
        d.ad.mcmcCertificateId !== null &&
        mediaReady(d) &&
        leadFormReady(d) &&
        (d.ad.format === "carousel"
          ? d.ad.carousel.cards.length >= CAROUSEL_MIN && d.ad.carousel.cards.every(cardReady)
          : d.ad.headline.trim() !== "") &&
        destinationReady(d)
      );
    case "review":
      return false;
  }
}

