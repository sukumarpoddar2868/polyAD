"use client";

import { useId } from "react";
import { Landmark } from "lucide-react";
import dynamic from "next/dynamic";
import { Field, Select } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { LANGUAGE_TO_LOCALES } from "../engine/presets.ts";
import { DEVICE_LABELS, type DeviceOs } from "./blueprint";
import type { SectionProps } from "./create-campaign";
import { AudienceEstimate } from "./audience-estimate";
import { AudienceTargeting } from "./audience-targeting";
import { SeatChooser } from "@/features/constituencies/components/seat-chooser";
import { useSeats } from "./use-seats";
import { ChipInput, ChoiceCard, Group, Header, Segmented, set } from "./sections";

// Map is browser-only (WebGL); loads after the page. Same map as the Constituencies page.
const SeatMap = dynamic(() => import("@/features/constituencies/components/seat-map"), {
  ssr: false,
  loading: () => <div className="grid h-72 place-items-center rounded-card bg-lavender-soft text-[13px] text-ink-muted">Loading map…</div>,
});

export function AudienceSection({ draft, update, goTo, clients }: SectionProps) {
  const a = draft.audience;
  const ageId = useId();
  const ages = Array.from({ length: 65 - 18 + 1 }, (_, i) => 18 + i);
  const { chosen, seats, mapSeats, setSeats, pending, error } = useSeats(draft, update);
  const candidateSeat = clients.find((c) => c.id === draft.clientId)?.seat ?? null;

  return (
    <>
      <Header level="Ad set" title="Audience" blurb="Which voters see the ad: the constituencies you choose, and who in them." />
      <div className="flex flex-col gap-6">
        <AudienceEstimate draft={draft} />

        <Group title="Who to target" hint="Core audience works for most campaigns. Add custom or lookalike audiences when you have supporters or engagers.">
          <AudienceTargeting draft={draft} update={update} client={clients.find((c) => c.id === draft.clientId)} />
        </Group>

        <Group
          title="Constituencies"
          hint="Each seat is covered with circles Meta can target (up to 5 seats). These are the same seats as in Start."
        >
          {chosen.length === 0 && (
            <Callout>
              Choose the seats here or in{" "}
              <button type="button" onClick={() => goTo("start")} className="font-bold text-tomato-700 hover:underline">
                Start
              </button>
              .
            </Callout>
          )}
          <SeatChooser id="audience-seats" value={chosen} onChange={setSeats} suggest={candidateSeat} />
          {pending && <p className="text-[13px] text-ink-muted">Working out the circles…</p>}
          {error && <p className="text-[13px] text-tomato-700">{error}</p>}
          {seats.length > 0 && (
            <ul className="flex flex-col gap-1">
              {seats.map((s) => (
                <li key={s.no} className="flex items-center gap-2 text-[13px] text-ink-muted">
                  <Landmark className="size-4 shrink-0 text-lavender-deep" aria-hidden />
                  <span>
                    <strong className="text-ink">
                      {s.no} · {s.name}
                    </strong>{" "}
                    — {s.pins.length} circles · covers ~{Math.round(s.coverage * 100)}% of the seat
                  </span>
                </li>
              ))}
            </ul>
          )}
          {seats.length > 0 && <SeatMap seats={mapSeats} />}
          {seats.length > 0 && <p className="text-[12px] text-ink-muted">Dark outline = the seat · tinted circles = what Meta targets. Circles may spill a little into neighbouring seats.</p>}
        </Group>

        <Group title="People">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id={`${ageId}-min`} label="Age from">
              <Select id={`${ageId}-min`} value={a.ageMin} onChange={(e) => set(update, "audience", { ageMin: Number(e.target.value), ageMax: Math.max(a.ageMax, Number(e.target.value)) })}>
                {ages.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={`${ageId}-max`} label="Age to">
              <Select id={`${ageId}-max`} value={a.ageMax} onChange={(e) => set(update, "audience", { ageMax: Number(e.target.value) })}>
                {ages.filter((n) => n >= a.ageMin).map((n) => (
                  <option key={n} value={n}>
                    {n === 65 ? "65+" : n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="language" label="Language">
              <Select id="language" value={a.language} onChange={(e) => set(update, "audience", { language: e.target.value })}>
                {Object.keys(LANGUAGE_TO_LOCALES).map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </Field>
          </div>
          {a.why && <p className="rounded-input bg-chartreuse-soft px-3 py-2 text-[13px]">AI: {a.why}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-bold">Gender</span>
            <Segmented
              label="Gender"
              value={a.gender}
              onChange={(v) => set(update, "audience", { gender: v })}
              options={[
                { value: "any", label: "All" },
                { value: "female", label: "Women" },
                { value: "male", label: "Men" },
              ]}
            />
          </div>
        </Group>

        <Group title="Phone type" hint="Reach only Android or only iPhone users. iPhone-only is a common way to reach higher-income buyers.">
          <Segmented
            label="Phone type"
            value={a.device}
            onChange={(v: DeviceOs) =>
              update((d) => ({
                ...d,
                audience: { ...d.audience, device: v },
                // Meta allows phone targeting only with manual placements.
                placements: v === "all" ? d.placements : { ...d.placements, mode: "manual" },
              }))
            }
            options={(Object.keys(DEVICE_LABELS) as DeviceOs[]).map((k) => ({ value: k, label: DEVICE_LABELS[k] }))}
          />
          {a.device !== "all" && (
            <p className="text-[13px] text-ink-muted">Ads show on phones only, and Placements switch to manual (Meta&apos;s rule for phone targeting).</p>
          )}
        </Group>

        <Group title="Interests" hint="Matched to real Meta interests at launch (closest match each). Leave empty to reach everyone in your areas who fits the age and gender.">
          <ChipInput id="interests" values={a.interests} max={5} onChange={(v) => set(update, "audience", { interests: v })} placeholder="e.g. Personal finance" />
        </Group>

        <Group title="Audience mode">
          <div role="radiogroup" aria-label="Audience mode" className="grid gap-3 sm:grid-cols-2">
            <ChoiceCard
              title="Local & strict"
              blurb="Only people matching your area, age and gender. Best for new accounts and small areas."
              badge="Recommended"
              selected={a.mode === "strict"}
              onSelect={() => set(update, "audience", { mode: "strict" })}
            />
            <ChoiceCard
              title="Let Meta find people"
              blurb="Advantage+ audience: Meta may go beyond your settings, but stays inside your areas."
              selected={a.mode === "advantage"}
              onSelect={() => set(update, "audience", { mode: "advantage" })}
            />
          </div>
        </Group>
      </div>
    </>
  );
}
