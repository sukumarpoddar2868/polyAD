@AGENTS.md

# PolyAd — project memory for Claude

Read this first instead of re-scanning the repo. Keep it short and current: update **Status** / **Next up** after meaningful work.

## Product
Internal tool for our agency to run **Indian political ads on Meta (FB/IG)** for several candidates and parties. First target: **Uttar Pradesh Assembly election** (403 seats, due ~Feb–Mar 2027).
Team makes images/videos; **AI (Groq) writes only the ad text** (Hindi/English, later Awadhi/Bhojpuri). No billing, no public signup.

## Origin
Forked 2026-11-20 from Shryxa Ads (`/home/sukumar/projects/Ads/shryxa_ads/web`, its `CLAUDE.md` documents the engine, geo resolver, create wizard, Meta gotchas in depth). Removed: Razorpay billing + cron, marketing site, signup, legal pages, Meta data-deletion/deauthorize callbacks (stay on Shryxa's app). Phase E also removed WhatsApp, Pixel, Sales and `/w/[token]`; lead forms stay (volunteer sign-ups, shown as "Sign-ups").

## Shared infrastructure (important)
- **Same Meta app as Shryxa**, Standard Access (only accounts where our team has app roles). Don't change its Login config while Shryxa's App Review runs. PolyAd redirect URI `${APP_URL}/api/meta/oauth/callback` must be in the app's Valid OAuth Redirect URIs.
- **Same Supabase project as Shryxa** (`hgslohnagcdtqxxzsbzl`) but PolyAd lives in **Postgres schema `polyad`** (`db()` sets `db: { schema: "polyad" }`); Shryxa owns `public`. Never touch `public.*`. Storage bucket **`polyad-media`** (not Shryxa's `ad-media`).
- Cookies `polyad_session` / `polyad_invite` so both apps can run on localhost.

## Team model
`polyad.users.owner_id`: null = admin/workspace owner, else the admin whose workspace the member shares. `requireUser()` returns `id` = **workspace id (scopes all data)** and `loginId` = the signed-in person (own password/sessions only). Admin adds/resets/removes members on `/admin` ("Team"). First admin: `pnpm run seed:admin` (ADMIN_EMAIL/ADMIN_PASSWORD).

## Stack & conventions
Same as Shryxa: Next.js 16 App Router + TS · Tailwind 4 · Zod 4 · supabase-js service-role only · custom bcrypt auth · Fernet token crypto · Groq · MapLibre + OpenFreeMap.
- `pnpm dev` · verify `pnpm run lint && pnpm run build` · `pnpm run test:engine` (50) · after adding routes `npx next typegen` before `tsc`.
- **Next 16 differs from training data** → `node_modules/next/dist/docs/`. Middleware = `src/proxy.ts`. `cacheComponents` ON (session reads inside `<Suspense>`). React 19 strict lint.
- Env only via `lib/env.ts`. Types hand-written in `lib/supabase/types.ts` (key `polyad`, mirror migrations). Every query scoped by `user.id`; `requireUser()` in every page and server action. Design tokens in `globals.css`, never raw hex.
- **Never change schema without the user's explicit approval**: write `supabase/migrations/000N_*.sql` → dry-run in a rolled-back txn via `psql "$DATABASE_URL"` → show SQL + ask → apply. `supabase/shryxa_reference/` = Shryxa's migrations, reference only.

## Political rules the product must enforce
- Meta: Page authorized for "Social Issues, Elections or Politics" + "Paid for by" disclaimer; ads sent with `special_ad_categories: ["ISSUES_ELECTIONS_POLITICS"]`; no targeting by religion/caste/politics interests.
- ECI: MCMC pre-certification per creative before it runs; **48-hour silence before polling, per phase/constituency**; ad spend counts toward candidate expenditure (report per candidate).
- AI text guardrails: no appeals on caste/religion/community, no personal attacks, no unverifiable claims (RPA s.123, MCC).

## Status
1. ✅ Fork + strip (2026-11-20): build/lint/tests green. `0001_polyad_schema.sql` **applied**, `polyad` exposed in Data API, bucket `polyad-media` created, admin seeded (id 1). Headless smoke test: login + all 7 pages render, no errors.

2. ✅ Constituency targeting (2026-11-20): `src/features/constituencies/` — `data/up-ac.json` (403 seats, built by `pnpm run build:constituencies <DataMeet India_AC folder>`, CC BY 2.5 → credit DataMeet), `cover.ts` (hex circle covering, integer-km radius stops, ≤40 circles/seat; median 95% covered, ~22% spill), `/constituencies` map page, wizard Audience "Add an Assembly constituency" (pins tagged `seat`, grouped card, no drag markers). Pin limit 30 → 200 (Meta max). Wizard picker not yet clicked through (needs a connected candidate).

3. ✅ Phase A — candidate profile + political mode (2026-11-20): migration `0002_candidate_profile.sql` **applied** (`clients.candidate_name/party/symbol/ac_no/paid_for_by/political_ready_at`; party null = Independent). `features/clients/political.ts` (`politicalGaps`, `UP_PARTIES`, ₹40L limit), profile form on `/clients/[id]`. Launch blocked until profile ready; every campaign sent as `ISSUES_ELECTIONS_POLITICS` + country IN, ads `authorization_category` POLITICAL (or `…_WITH_DIGITALLY_CREATED_MEDIA` via wizard checkbox). Wizard suggests the candidate's seat. Browser-tested profile save. Onboarding checklist (`onboardingSteps`) on candidate page: details → Page access (invite/BM) → ad account → Page political authorization (Facebook only, Meta has NO API for it or the disclaimer) → "Paid for by" text.

4. ✅ Phase B — political AI copy (2026-11-20): `campaigns/ai/political.ts` (languages hi/hinglish/en, `ELECTION_RULES` prompt block, `guardrailHits` keyword check: religion/caste/inducement/attack/forces, Latin whole-word + Devanagari substring, candidate's own name/party/seat allowed). `politicalCopyPrompt` + `politicalAudience` (18–65+, any gender, no interests) in prompts.ts; `generatePoliticalCopy` rewrites up to 2× when flagged. Start step: candidate brief + language + **constituencies** (`SeatChooser`, ≤5 seats = `MAX_SEATS`, default = candidate's seat; each seat → circles, 200/n per seat). City search + "how wide" + currency removed from Start (Audience still has city search; INR only). Creative shows live check; launch blocks on hits unless `ad.copyReviewed`. Audience language default "All languages" (no locale filter — was English-only).

5. ✅ Phase C — ECI compliance gate (2026-11-20): migration `0003_compliance.sql` **applied** (`mcmc_certificates`, `poll_schedule` PK (user_id, ac_no), `campaigns.mcmc_certificate_id`). `features/compliance/`: `silence.ts` (pure: 48 h window ending at poll close, IST; `checkSilence` → blocked / capAt / missing), certificates card on candidate page (scan JPG/PNG → `polyad-media` `u{user}/c{client}/mcmc/`; bucket rejects PDF), `/schedule` page (date per districts/seat ranges). Wizard Creative: certificate picker (`ad.mcmcCertificateId`, required for the tick). Launch: needs the candidate's own certificate; seats = `seatsTouched(pins)` + candidate seat; blocked inside a window; otherwise ad set `end_time` capped at the earliest window start (`RenderInput.endTime`); note lists seats without a poll date. Browser-tested certificate + schedule add/delete.

6. ✅ Phase D — spend vs ECI limit (2026-11-20; `0004_expense_budget.sql` **applied**: `clients.ad_budget_inr` (incl. GST, null = whole ₹40L) + `expense_from` date). `features/spend/`: `limits.ts` (pure: 18% GST, `allowance` = budget − spent − committed, `checkNewCampaign`), `load.ts` (live Meta insights for the whole ad account from `expense_from`; committed = spend_cap − spend of non-finished campaigns; uncapped campaigns listed), candidate-page "Election expenditure" card + budget form, CSV `/api/clients/[id]/expenses` (day × campaign, GST est.). Launch: blocks if the campaign's spend cap doesn't fit; daily budgets get `spendCapMax` = headroom. Budget form browser-tested; spend meter not yet tested with real spend (no connected candidate).
7. ✅ Phase E — trim (2026-11-20, no schema change): deleted `/w/[token]`, `campaigns/whatsapp/`, `campaigns/pixel/`, WhatsApp editor/link check, Pixel setup + picker + discovery, `CONVERSION_TRACKING_VERIFIED`. Product layer uses `POLYAD_OBJECTIVES` (Awareness, Sign-ups=LEADS, Engagement, Traffic) + `POLYAD_DESTINATIONS` / `PolyadDestination` (presets.ts); engine stays generic (still knows WhatsApp/Pixel, parity tests). Pixel guard always on. Business-style AI prompts removed (only political). Old drafts: SALES→TRAFFIC, whatsapp→default destination. `clients.pixel_*` columns unused. List/metrics keep Sales/WhatsApp labels for campaigns made outside PolyAd.

8. ✅ Seat-only targeting (2026-11-20, no schema change): constituencies are the ONLY way to pick places. `create/use-seats.ts` (`useSeats`) is shared by Start (`SeatChooser`) and Audience ("Constituencies": same chips + `SeatMap` with outlines + circles); `setup.seats` mirrors seat-tagged pins in `audience.locations` (what Meta gets). Deleted `campaigns/geo/`, `area-map.tsx`, `seat-picker.tsx`, city search/sliders, AI location prompts; `normalizeDraft` drops non-seat pins from old drafts. Browser-tested 2 seats Start↔Audience.

## Next up
1. Add PolyAd redirect URI to the Meta app; connect a test candidate (Page + ad account); launch one seat with `validate_only` to confirm Meta accepts overlapping circles.
2. Enter the ECI poll dates on /schedule once announced. Later: warn on campaigns launched before their seats had a poll date (they aren't capped).
3. Wording: some wizard/candidate texts still say "client"/"business" (e.g. "Business & goal", "once you choose a client"). Audience still shows Interests/Phone type and Core/Custom/Lookalike cards ("customers") — trim for political use.

## Working agreements
- Commit only when asked; never stage `.env*`. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Explain simply; the user prefers short answers.
