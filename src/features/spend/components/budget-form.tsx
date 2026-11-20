"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { saveBudgetAction, type BudgetState } from "../actions";

export function BudgetForm({ clientId, budget, from, limit }: { clientId: number; budget: number | null; from: string | null; limit: number }) {
  const [state, action, pending] = useActionState<BudgetState, FormData>(saveBudgetAction.bind(null, clientId), {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Callout tone="error">{state.error}</Callout>}
      {state.ok && <Callout tone="success">Saved.</Callout>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="budget" label="Ad budget (₹, incl. GST)" hint={`The part of the ₹${limit.toLocaleString("en-IN")} ECI limit set aside for Facebook/Instagram ads. Empty = the whole limit.`}>
          <Input id="budget" name="budget" inputMode="numeric" defaultValue={budget ?? ""} placeholder={limit.toLocaleString("en-IN")} />
        </Field>
        <Field id="from" label="Count spend from" hint="Usually the nomination date. Empty = all spend on the ad account.">
          <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={pending} className="self-start">
        {pending ? "Saving…" : "Save budget"}
      </Button>
    </form>
  );
}
