/** Candidate profile rules shared by the profile form, the client page and launch. Pure. */
import type { ClientRow } from "@/lib/supabase/types";
import type { ReadinessItem } from "@/features/meta-connect/discovery";

export const INDEPENDENT = "Independent";
/** Suggestions only — any party name can be typed. */
export const UP_PARTIES = [
  "Bharatiya Janata Party (BJP)",
  "Samajwadi Party (SP)",
  "Bahujan Samaj Party (BSP)",
  "Indian National Congress (INC)",
  "Rashtriya Lok Dal (RLD)",
  "Apna Dal (Soneylal)",
  "Suheldev Bharatiya Samaj Party (SBSP)",
  "Nishad Party",
  "Aazad Samaj Party (Kanshi Ram)",
  "Aam Aadmi Party (AAP)",
  INDEPENDENT,
];

/** ECI election-expense limit for an Assembly candidate in UP (₹40 lakh, 2022 revision). */
export const UP_AC_SPEND_LIMIT_INR = 40_00_000;

export const partyLabel = (party: string | null) => party?.trim() || INDEPENDENT;

type Profile = Pick<ClientRow, "candidate_name" | "ac_no" | "paid_for_by" | "political_ready_at">;

/** What still blocks political ads for this candidate (empty = ready). */
export function politicalGaps(c: Profile): string[] {
  const gaps: string[] = [];
  if (!c.candidate_name?.trim()) gaps.push("Add the candidate's name.");
  if (!c.ac_no) gaps.push("Pick the constituency they are contesting.");
  if (!c.paid_for_by?.trim()) gaps.push("Add the “Paid for by” disclaimer exactly as set on the Page.");
  if (!c.political_ready_at) gaps.push("Confirm the Page is authorized for political ads in Meta.");
  return gaps;
}

/** Meta's guide to Page authorization + disclaimer (no API exists for either; a Page admin does it on Facebook). */
export const META_POLITICAL_AUTH_HELP = "https://www.facebook.com/business/help/208949576550051";

type Onboard = Profile & Pick<ClientRow, "page_id" | "ad_account_id">;

/**
 * Candidate onboarding, in order. Everything except step 4 happens inside PolyAd;
 * step 4 is the one thing Meta only allows on Facebook itself.
 */
export function onboardingSteps(c: Onboard, connected: boolean): ReadinessItem[] {
  const details = Boolean(c.candidate_name?.trim() && c.ac_no);
  const page = connected && Boolean(c.page_id);
  return [
    {
      key: "details",
      label: "1. Candidate details",
      state: details ? "ok" : "todo",
      detail: details ? "Name and constituency saved." : "Fill in the candidate profile below: name, constituency, party (or Independent).",
    },
    {
      key: "page",
      label: "2. Access to the candidate's Facebook Page",
      state: page ? "ok" : "todo",
      detail: page
        ? "Page connected."
        : "Send the candidate the invite link below (one tap on their phone), or pick the Page from your Business Manager. No Page yet? Create one for them and make them owner.",
    },
    {
      key: "account",
      label: "3. Ad account",
      state: c.ad_account_id ? "ok" : "todo",
      detail: c.ad_account_id ? "Ad account chosen." : "After connecting, choose the ad account the ads are paid from (usually your agency's).",
    },
    {
      key: "authorize",
      label: "4. Turn on political ads for the Page (on Facebook, once)",
      state: c.political_ready_at ? "ok" : "todo",
      detail: c.political_ready_at
        ? "Confirmed."
        : "Meta allows this only on Facebook, not through any app. Open the Page → Settings → Issue, electoral or political ads → link it to your verified account and create the “Paid for by” disclaimer. Then tick the box in the profile below.",
      action: { label: "Meta's guide", href: META_POLITICAL_AUTH_HELP },
    },
    {
      key: "disclaimer",
      label: "5. “Paid for by” text in PolyAd",
      state: c.paid_for_by?.trim() ? "ok" : "todo",
      detail: c.paid_for_by?.trim() ? `“Paid for by ${c.paid_for_by.trim()}”` : "Type the disclaimer exactly as created on Facebook, in the profile below.",
    },
  ];
}
