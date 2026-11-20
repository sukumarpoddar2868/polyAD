"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Callout } from "@/components/ui/surface";
import { loginAction } from "../actions";
import type { AuthFormState } from "../schemas";

const initial: AuthFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.error && <Callout tone="error">{state.error}</Callout>}
      <Field id="email" label="Email" error={fe.email}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={!!fe.email}
          aria-describedby={fe.email ? "email-error" : undefined}
        />
      </Field>
      <Field id="password" label="Password" error={fe.password}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!fe.password}
          aria-describedby={fe.password ? "password-error" : undefined}
        />
      </Field>
      <Button type="submit" size="lg" disabled={pending} className="mt-2">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-sm text-ink-muted">No account? Ask your PolyAd admin to add you.</p>
    </form>
  );
}
