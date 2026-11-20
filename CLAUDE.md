@AGENTS.md

# PolyAd — project memory for Claude

Read this first instead of re-scanning the repo. Keep it short and current: update **Status** / **Next up** after meaningful work.

## Product
Internal tool for our agency to run **Indian political ads on Meta (FB/IG)** for several candidates and parties. First target: **Uttar Pradesh Assembly election** (403 seats, due ~Feb–Mar 2027).
Team makes images/videos; **AI (Groq) writes only the ad text** (Hindi/English, later Awadhi/Bhojpuri). No billing, no public signup.

## Origin
Forked 2026-11-20 from Shryxa Ads (`/home/sukumar/projects/Ads/shryxa_ads/web`, its `CLAUDE.md` documents the engine, geo resolver, create wizard, Meta gotchas in depth). Removed: Razorpay billing + cron, marketing site, signup, legal pages, Meta data-deletion/deauthorize callbacks (stay on Shryxa's app). Kept for now: lead forms (volunteer sign-ups, shown as "Sign-ups"), WhatsApp, Pixel, `/w/[token]` — to be trimmed when the political wizard is built.

## Shared infrastructure (important)
- **Same Meta app as Shryxa**, Standard Access (only accounts where our team has app roles). Don't change its Login config while Shryxa's App Review runs. PolyAd redirect URI `${APP_URL}/api/meta/oauth/callback` must be in the app's Valid OAuth Redirect URIs.
- **Same Supabase project as Shryxa** (`hgslohnagcdtqxxzsbzl`) but PolyAd lives in **Postgres schema `polyad`** (`db()` sets `db: { schema: "polyad" }`); Shryxa owns `public`. Never touch `public.*`. Storage bucket **`polyad-media`** (not Shryxa's `ad-media`).
- Cookies `polyad_session` / `polyad_invite` so both apps can run on localhost.

## Team model
`polyad.users.owner_id`: null = admin/workspace owner, else the admin whose workspace the member shares. `requireUser()` returns `id` = **workspace id (scopes all data)** and `loginId` = the signed-in person (own password/sessions only). Admin adds/resets/removes members on `/admin` ("Team"). First admin: `pnpm run seed:admin` (ADMIN_EMAIL/ADMIN_PASSWORD).

## Stack & conventions
Same as Shryxa: Next.js 16 App Router + TS · Tailwind 4 · Zod 4 · supabase-js service-role only · custom bcrypt auth · Fernet token crypto · Groq · MapLibre + OpenFreeMap.
- `pnpm dev` · verify `pnpm run lint && pnpm run build` · `pnpm run test:engine` (40) · after adding routes `npx next typegen` before `tsc`.
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

## Next up
1. Add PolyAd redirect URI to the Meta app; connect a test candidate (Page + ad account); launch one seat with `validate_only` to confirm Meta accepts overlapping circles.
2. Poll phase/date per seat (ECI schedule, when announced) for the silence-period gate.
3. Candidate/party profile, political ad category + disclaimer, compliance gate (MCMC cert, silence period), Hindi AI copy with guardrails, spend per candidate.

## Working agreements
- Commit only when asked; never stage `.env*`. Trailer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Explain simply; the user prefers short answers.
