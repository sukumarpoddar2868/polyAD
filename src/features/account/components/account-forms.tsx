"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { changePasswordAction, type FormState } from "../actions";

export function PasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(changePasswordAction, {});
  return (
    <form action={action} className="grid gap-4 sm:max-w-md">
      <Field id="pw-current" label="Current password">
        <Input id="pw-current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field id="pw-next" label="New password" hint="At least 8 characters.">
        <Input id="pw-next" name="next" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field id="pw-confirm" label="Repeat new password">
        <Input id="pw-confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      {state.error && <Callout tone="error">{state.error}</Callout>}
      {state.ok && <Callout tone="success">{state.message}</Callout>}
      <Button type="submit" variant="secondary" disabled={pending} className="justify-self-start">
        {pending ? "Saving…" : "Change password"}
      </Button>
    </form>
  );
}
