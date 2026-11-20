"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { verifyPassword } from "./password";
import { createSession, destroySession } from "./session";
import { LoginSchema, type AuthFormState } from "./schemas";

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: AuthFormState["fieldErrors"] = {};
  for (const i of issues) {
    const key = i.path[0] as keyof NonNullable<AuthFormState["fieldErrors"]>;
    out[key] ??= i.message;
  }
  return out;
}

export async function loginAction(_prev: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = LoginSchema.safeParse(Object.fromEntries(form));
  const values = { email: String(form.get("email") ?? "") };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues), values };

  const { email, password } = parsed.data;
  const { data: user } = await db()
    .from("users")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return { error: "Incorrect email or password.", values };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
