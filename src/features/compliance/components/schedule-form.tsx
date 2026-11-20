"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { saveScheduleAction, type FormState } from "../actions";

/** One poll date for a set of districts and/or seat numbers. Re-saving a seat replaces its date. */
export function ScheduleForm({ districts }: { districts: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveScheduleAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Callout tone="error">{state.error}</Callout>}
      {state.ok && <Callout tone="success">Saved for {state.saved} seat{state.saved === 1 ? "" : "s"}.</Callout>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="phase" label="Phase (optional)">
          <Input id="phase" name="phase" type="number" min={1} max={10} placeholder="e.g. 1" />
        </Field>
        <Field id="pollDate" label="Poll date">
          <Input id="pollDate" name="pollDate" type="date" required />
        </Field>
        <Field id="pollEnd" label="Polling closes (IST)" hint="Usually 6:00 pm; earlier in some seats.">
          <Input id="pollEnd" name="pollEnd" type="time" required defaultValue="18:00" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[13px] font-bold">Districts</legend>
        <div className="grid max-h-56 grid-cols-2 gap-x-4 gap-y-1 overflow-y-auto rounded-input bg-lavender-soft p-3 text-[14px] sm:grid-cols-3 lg:grid-cols-5">
          {districts.map((d) => (
            <label key={d} className="flex items-center gap-2">
              <input type="checkbox" name="district" value={d} className="size-4 accent-lavender-deep" /> {d}
            </label>
          ))}
        </div>
      </fieldset>
      <Field id="seats" label="And/or seat numbers" hint="Commas and ranges, e.g. 174, 180-185.">
        <Input id="seats" name="seats" placeholder="e.g. 170-176" />
      </Field>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save poll date"}
      </Button>
    </form>
  );
}
