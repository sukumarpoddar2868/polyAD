"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { addMemberAction, resetMemberPasswordAction, type TeamFormState } from "../actions";

export function AddMemberForm() {
  const [state, action, pending] = useActionState<TeamFormState, FormData>(addMemberAction, {});
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <Field id="m-email" label="Email">
        <Input id="m-email" name="email" type="email" autoComplete="off" required />
      </Field>
      <Field id="m-pw" label="Temporary password" hint="At least 8 characters.">
        <Input id="m-pw" name="password" type="text" autoComplete="off" minLength={8} required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add member"}
      </Button>
      {state.error && <div className="sm:col-span-3"><Callout tone="error">{state.error}</Callout></div>}
      {state.ok && <div className="sm:col-span-3"><Callout tone="success">{state.message}</Callout></div>}
    </form>
  );
}

export function ResetPasswordForm({ userId, email }: { userId: number; email: string }) {
  const [state, action, pending] = useActionState<TeamFormState, FormData>(resetMemberPasswordAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="userId" value={userId} />
      <Input name="password" type="text" minLength={8} required placeholder="New password" aria-label={`New password for ${email}`} className="h-9 w-44 text-[14px]" />
      <Button size="sm" variant="secondary" type="submit" disabled={pending}>
        Reset
      </Button>
      {state.error && <span className="text-[13px] text-tomato-700">{state.error}</span>}
      {state.ok && <span className="text-[13px] text-ink-muted">{state.message}</span>}
    </form>
  );
}
