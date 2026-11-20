import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/lib/supabase/server";
import { readSessionUserId } from "./session";

/**
 * Narrow, client-safe view of the signed-in user.
 *
 * PolyAd is an internal tool: every team member works in one shared
 * workspace (the admin's). `id` is that workspace id and scopes ALL data
 * queries (clients, campaigns, media). `loginId` is the person actually
 * signed in — use it only for their own password and sessions.
 */
export type CurrentUser = {
  id: number;
  loginId: number;
  email: string;
  isAdmin: boolean;
  clientLimit: number;
  // Always "agency" in PolyAd; the "business" branches inherited from Shryxa never run.
  accountType: "business" | "agency";
};

/** Data Access Layer: the one place that resolves "who is this request?". */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const userId = await readSessionUserId();
  if (!userId) return null;

  const { data: u } = await db().from("users").select("id, email, is_admin, owner_id").eq("id", userId).maybeSingle();
  if (!u) return null;

  return {
    id: u.owner_id ?? u.id,
    loginId: u.id,
    email: u.email,
    isAdmin: Boolean(u.is_admin),
    // Internal tool: no plan limits on how many candidates/parties we manage.
    clientLimit: 10_000,
    accountType: "agency" as const,
  };
});

/** Use in protected pages, layouts and every server action. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/dashboard");
  return user;
}
