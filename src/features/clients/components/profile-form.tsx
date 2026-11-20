"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import type { Client } from "../data";
import { saveProfileAction, type ProfileState } from "../actions";
import { INDEPENDENT, UP_PARTIES } from "../political";

export type SeatOption = { no: number; name: string; reserved: string | null; district: string };

export function ProfileForm({ client, seats }: { client: Client; seats: SeatOption[] }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfileAction.bind(null, client.id), {});
  const districts = [...new Set(seats.map((s) => s.district))].sort();

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Callout tone="error">{state.error}</Callout>}
      {state.ok && <Callout tone="success">Saved.</Callout>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="candidateName" label="Candidate name">
          <Input id="candidateName" name="candidateName" required defaultValue={client.candidate_name ?? client.business_name ?? ""} placeholder="e.g. Ramesh Kumar" />
        </Field>
        <Field id="acNo" label="Constituency contested">
          <Select id="acNo" name="acNo" required defaultValue={client.ac_no ?? ""}>
            <option value="" disabled>
              Pick a seat…
            </option>
            {districts.map((d) => (
              <optgroup key={d} label={d}>
                {seats
                  .filter((s) => s.district === d)
                  .map((s) => (
                    <option key={s.no} value={s.no}>
                      {s.no} · {s.name}
                      {s.reserved ? ` (${s.reserved})` : ""}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field id="party" label="Party" hint="Leave empty or pick “Independent” for a candidate without a party.">
          <Input id="party" name="party" list="up-parties" defaultValue={client.party ?? ""} placeholder={INDEPENDENT} />
        </Field>
        <datalist id="up-parties">
          {UP_PARTIES.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        <Field id="symbol" label="Election symbol" hint="Optional. Independents get theirs after nominations close.">
          <Input id="symbol" name="symbol" defaultValue={client.symbol ?? ""} placeholder="e.g. Lantern" />
        </Field>
      </div>
      <Field id="paidForBy" label="“Paid for by” disclaimer" hint="Exactly as set on the Page’s political ads authorization in Meta.">
        <Input id="paidForBy" name="paidForBy" defaultValue={client.paid_for_by ?? ""} placeholder="e.g. Ramesh Kumar" />
      </Field>
      <label className="flex items-start gap-3 rounded-card bg-lavender-soft p-4 text-[14px]">
        <input type="checkbox" name="politicalReady" defaultChecked={Boolean(client.political_ready_at)} className="mt-0.5 size-4 accent-lavender-deep" />
        <span>
          <span className="block font-bold">The Page is authorized for political ads</span>
          <span className="block text-ink-muted">
            Done in Meta: Page settings → Authorizations → Issue, electoral or political ads (ID check for whoever runs the ads, plus the disclaimer above).
          </span>
        </span>
      </label>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
