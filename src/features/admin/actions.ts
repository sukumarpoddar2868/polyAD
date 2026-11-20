"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/features/auth/dal";
import { hashPassword } from "@/features/auth/password";
import { MemberSchema } from "@/features/auth/schemas";
import { db } from "@/lib/supabase/server";

export type TeamFormState = { ok?: boolean; error?: string; message?: string };

const UserId = z.coerce.number().int().positive();

/** Add a login to the admin's workspace. They share every candidate and campaign. */
export async function addMemberAction(_prev: TeamFormState, form: FormData): Promise<TeamFormState> {
  const admin = await requireAdmin();
  const p = MemberSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form." };
  const { error } = await db()
    .from("users")
    .insert({ email: p.data.email, password_hash: await hashPassword(p.data.password), owner_id: admin.id, is_admin: 0, created_at: new Date().toISOString() });
  if (error) return { error: error.code === "23505" ? "Someone with this email is already on the team." : "Couldn't add this person. Try again." };
  revalidatePath("/admin");
  return { ok: true, message: `${p.data.email} can now sign in. Ask them to change the password on the Account page.` };
}

/** Set a new temporary password for a member and sign them out everywhere. */
export async function resetMemberPasswordAction(_prev: TeamFormState, form: FormData): Promise<TeamFormState> {
  const admin = await requireAdmin();
  const id = UserId.parse(form.get("userId"));
  const pw = z.string().min(8, "Password must be at least 8 characters.").max(128).safeParse(form.get("password"));
  if (!pw.success) return { error: pw.error.issues[0]?.message };
  const { data } = await db().from("users").update({ password_hash: await hashPassword(pw.data) }).eq("id", id).eq("owner_id", admin.id).select("id");
  if (!data?.length) return { error: "Team member not found." };
  await db().from("sessions").delete().eq("user_id", id);
  return { ok: true, message: "Password changed. They were signed out." };
}

/** Remove a member's login. Their work stays: it belongs to the shared workspace. */
export async function removeMemberAction(form: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = UserId.parse(form.get("userId"));
  await db().from("users").delete().eq("id", id).eq("owner_id", admin.id);
  revalidatePath("/admin");
}
