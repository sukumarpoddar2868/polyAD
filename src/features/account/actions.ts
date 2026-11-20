"use server";

import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import { hashPassword, verifyPassword } from "@/features/auth/password";
import { endOtherSessions } from "@/features/auth/session";
import { db } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; message?: string; error?: string };

const PasswordForm = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(8, "Use at least 8 characters.").max(128),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { message: "The new passwords don't match.", path: ["confirm"] });

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = PasswordForm.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form." };
  const { data } = await db().from("users").select("password_hash").eq("id", user.loginId).single();
  if (!data || !(await verifyPassword(p.data.current, data.password_hash))) return { error: "Your current password is wrong." };
  await db().from("users").update({ password_hash: await hashPassword(p.data.next) }).eq("id", user.loginId);
  await endOtherSessions(user.loginId);
  return { ok: true, message: "Password changed. Other devices were signed out." };
}
