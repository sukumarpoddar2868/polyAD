"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { generateSetupAction } from "../ai/actions";
import { SeatChooser } from "@/features/constituencies/components/seat-chooser";
import { useSeats } from "./use-seats";
import { COPY_LANGUAGES, LANGUAGE_INFO, describeHits } from "../ai/political.ts";
import { OBJECTIVE_OPTIONS, defaultCta, defaultDestination, destinationOptions, type ObjectiveId } from "./blueprint";
import { DestinationDetails } from "./destination-details";
import type { SectionProps } from "./create-campaign";
import { ChoiceCard, Group, Header, Segmented, TextArea, set } from "./sections";

/**
 * Start: goal (objective) → destination → about the business → customers →
 * AI drafts the whole campaign. Every AI-filled field stays editable later.
 */
export function StartSection({ draft, update, clients, isAgency, goTo }: SectionProps & { isAgency: boolean }) {
  const s = draft.setup;
  const client = clients.find((c) => c.id === draft.clientId);
  const objective = OBJECTIVE_OPTIONS.find((o) => o.id === draft.objective);
  const destinations = draft.objective ? destinationOptions(draft.objective, client) : [];
  const destination = draft.ad.destination;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [flags, setFlags] = useState<string[]>([]);
  const fe = (k: string) => fieldErrors[k];
  // Nothing chosen yet → the candidate's own seat.
  const seatsCtl = useSeats(draft, update);
  const seatList = seatsCtl.chosen.length ? seatsCtl.chosen : client?.seat ? [client.seat] : [];

  const chooseObjective = (id: ObjectiveId | "") =>
    update((d) => ({
      ...d,
      objective: id || null,
      ad: id
        ? {
            ...d.ad,
            destination: defaultDestination(id),
            cta: defaultCta(id, defaultDestination(id)),
          }
        : d.ad,
    }));

  const generate = () => {
    if (!draft.objective || !draft.clientId) return;
    setError(null);
    setFieldErrors({});
    setNotice(null);
    setFlags([]);
    const objectiveId = draft.objective;
    if (!seatList.length) {
      setFieldErrors({ seats: "Choose at least one constituency." });
      return;
    }
    start(async () => {
      const r = await generateSetupAction({
        clientId: draft.clientId!,
        objective: objectiveId,
        destination: draft.ad.destination,
        businessName: s.businessName,
        website: s.website.trim(),
        about: s.about,
        offer: s.offer,
        seats: seatList.map((x) => x.no),
        language: s.language,
      });
      if (!r.ok) {
        setError(r.error);
        setFieldErrors(r.fieldErrors ?? {});
        return;
      }
      const c = r.copy;
      setFlags(describeHits(r.flags));
      update((d) => ({
        ...d,
        generated: true,
        setup: { ...d.setup, seats: r.seats.map(({ no, name }) => ({ no, name })) },
        campaign: { ...d.campaign, name: c.campaign_name, amount: String(c.daily_budget), budgetType: "daily" },
        audience: {
          ...d.audience,
          locations: r.seats.flatMap((st) =>
            st.pins.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng, radiusKm: p.radius_km, why: p.why, geo: p.geo, seat: { no: st.no, name: st.name, coverage: st.coverage } })),
          ),
          ageMin: c.age_min,
          ageMax: c.age_max,
          gender: c.gender,
          interests: c.interest_targeting,
          mode: "strict",
          device: c.device_os,
          why: c.audience_why,
        },
        // Meta allows phone targeting only with manual placements.
        placements: c.device_os === "all" ? { ...d.placements, mode: "advantage" } : { mode: "manual", facebook: true, instagram: true },
        ad: {
          ...d.ad,
          url: d.ad.destination === "website" && s.website.trim() ? s.website.trim() : d.ad.url,
          primaryText: c.primary_text,
          headline: c.headline,
          description: c.description ?? "",
          cta: c.call_to_action,
          cardIdeas: c.carousel_cards,
          copyReviewed: false,
          leadForm: {
            ...d.ad.leadForm,
            name: d.ad.leadForm.name || `${s.businessName} volunteers`.slice(0, 60),
            questions: c.lead_questions,
            thankYou: c.thank_you_message || d.ad.leadForm.thankYou,
          },
          // Already a carousel? Refresh card text, keep the uploaded images.
          carousel: {
            ...d.ad.carousel,
            cards: d.ad.carousel.cards.map((card, i) =>
              c.carousel_cards[i] ? { ...card, headline: c.carousel_cards[i].headline, description: c.carousel_cards[i].description } : card,
            ),
          },
        },
      }));
      setNotice(
        r.usedFallback
          ? "The AI was busy, so we drafted simple text from your brief. Everything else is filled — review and edit."
          : `Done — ${r.seats.map((st) => `${st.no} · ${st.name}`).join(", ")} (${r.seats.reduce((n, st) => n + st.pins.length, 0)} circles), budget and ad text are filled in. Review each step and edit anything.`,
      );
    });
  };

  return (
    <>
      <Header
        level="Start"
        title="What should voters hear?"
        blurb="Pick the goal, give the AI a short brief, and it fills the campaign — name, budget, the candidate's seat and the ad text in Hindi or English, within election rules. You can edit every field after."
      />
      <div className="flex flex-col gap-6">
        {/* 1. Goal → destination: first, so the AI writes for it */}
        <Group title="Campaign goal" hint="Meta optimises delivery for this goal. It can't be changed after launch.">
          <Field id="objective" label="Objective" hint={objective?.blurb}>
            <Select id="objective" value={draft.objective ?? ""} onChange={(e) => chooseObjective(e.target.value as ObjectiveId | "")}>
              <option value="">Choose a goal…</option>
              {OBJECTIVE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id} disabled={!o.available}>
                  {o.label}
                  {o.note ? ` — ${o.note}` : ""}
                </option>
              ))}
            </Select>
          </Field>

          {destinations.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold">Where should people go?</span>
              <div role="radiogroup" aria-label="Destination" className="grid gap-3 sm:grid-cols-2">
                {destinations.map((o) => (
                  <ChoiceCard
                    key={o.id}
                    title={o.label}
                    blurb={o.blurb}
                    badge={o.note}
                    disabled={!o.available}
                    selected={o.available && destination === o.id}
                    onSelect={() => set(update, "ad", { destination: o.id, cta: defaultCta(draft.objective!, o.id) })}
                  />
                ))}
              </div>
            </div>
          )}

          {draft.objective && <DestinationDetails draft={draft} update={update} client={client} websiteError={fe("website")} />}
        </Group>

        {/* 2. Candidate + brief */}
        <Group title="Candidate and message">
          {clients.length === 0 ? (
            <Callout>
              No client is connected to Facebook yet.{" "}
              <Link href="/clients" className="font-bold text-tomato-700 hover:underline">
                Connect one →
              </Link>
            </Callout>
          ) : (
            isAgency && (
              <Field id="client" label="Candidate">
                <Select
                  id="client"
                  value={draft.clientId ?? ""}
                  onChange={(e) => {
                    const next = clients.find((c) => c.id === Number(e.target.value));
                    update((d) => ({
                      ...d,
                      clientId: next?.id ?? null,
                      setup: { ...d.setup, businessName: next?.name ?? d.setup.businessName },
                    }));
                    seatsCtl.setSeats(next?.seat ? [next.seat] : []);
                  }}
                >
                  <option value="">Choose a candidate…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.ready ? "" : " (setup needed)"}
                    </option>
                  ))}
                </Select>
              </Field>
            )
          )}
          {client && (
            <dl className="grid gap-2 rounded-card bg-lavender-soft p-4 text-[14px] sm:grid-cols-3">
              {[
                ["Ad account", client.adAccountName],
                ["Facebook Page", client.pageName],
                ["Instagram", client.instagramUsername ? `@${client.instagramUsername}` : null],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[12px] font-bold text-ink-muted">{k}</dt>
                  <dd className={v ? "font-bold" : "text-ink-muted"}>{v ?? "Not set"}</dd>
                </div>
              ))}
            </dl>
          )}
          {client && client.politicalGaps.length > 0 && (
            <Callout tone="error">
              Political ads can&apos;t launch until the candidate profile is done: {client.politicalGaps.join(" ")}{" "}
              <Link href={`/clients/${client.id}`} className="font-bold underline">
                Open profile →
              </Link>
            </Callout>
          )}
          {client && !client.ready && (
            <Callout tone="error">
              This candidate needs an ad account and Page before launch.{" "}
              <Link href={`/clients/${client.id}`} className="font-bold underline">
                Finish setup →
              </Link>
            </Callout>
          )}
          <Field id="businessName" label="Candidate name" error={fe("businessName")} hint="Party, symbol and seat come from the candidate profile.">
            <Input id="businessName" value={s.businessName} aria-invalid={!!fe("businessName")} onChange={(e) => set(update, "setup", { businessName: e.target.value })} />
          </Field>
          <Field id="about" label="About the candidate" error={fe("about")} hint="Only true, checkable facts — the AI uses nothing else.">
            <TextArea
              id="about"
              max={2000}
              rows={4}
              value={s.about}
              onChange={(v) => set(update, "setup", { about: v })}
              placeholder="e.g. Two-time MLA from this seat. Built the new district hospital wing (2023) and 40 km of village roads. Local, born in Aminabad."
            />
          </Field>
          <Field id="offer" label="What should this ad say?" error={fe("offer")} hint="The one message: a plan, an issue, an event, or the vote appeal.">
            <TextArea
              id="offer"
              max={2000}
              rows={3}
              value={s.offer}
              onChange={(v) => set(update, "setup", { offer: v })}
              placeholder="e.g. Ask for the vote: clean water in every ward and a degree college for the seat, as in the party manifesto."
            />
          </Field>
        </Group>

        {/* 3. Voters */}
        <Group title="Language and voters">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold">Ad text language</span>
            <Segmented
              label="Ad text language"
              value={s.language}
              onChange={(v) => set(update, "setup", { language: v })}
              options={COPY_LANGUAGES.map((x) => ({ value: x, label: LANGUAGE_INFO[x].label }))}
            />
          </div>
          <Field
            id="seats"
            label="Constituencies"
            error={fe("seats")}
            hint={`Ads reach voters in these Assembly seats (up to 5). ${client?.seat ? "" : "Tip: set the candidate's own seat on their profile."}`.trim()}
          >
            <SeatChooser id="seats" value={seatList} onChange={seatsCtl.setSeats} suggest={client?.seat ?? null} />
          </Field>
        </Group>

        {/* 4. Generate */}
        <div className="flex flex-col gap-3 rounded-card bg-lavender-soft p-5">
          <p className="text-[14px] text-ink-muted">
            {!client ? (
              "Choose a candidate first."
            ) : !objective ? (
              "Choose a campaign goal first."
            ) : (
              <>
                Building a <strong className="text-ink">{objective.label}</strong> campaign for <strong className="text-ink">{client.name}</strong>.
                {draft.generated && " Generating again replaces the AI-filled fields, including your edits."}
              </>
            )}
          </p>
          {error && <Callout tone="error">{error}</Callout>}
          {notice && <Callout tone="success">{notice}</Callout>}
          {flags.length > 0 && (
            <Callout tone="error">
              The AI text still has words that may break election rules — fix them in Creative: {flags.join(" · ")}
            </Callout>
          )}
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={generate} disabled={pending || !objective || !client} aria-busy={pending}>
              <Sparkles className="size-4" aria-hidden />
              {pending ? "Building your campaign…" : draft.generated ? "Generate again" : "Generate campaign with AI"}
            </Button>
            {draft.generated && !pending && (
              <Button type="button" variant="secondary" onClick={() => goTo("name-budget")}>
                Review campaign <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
