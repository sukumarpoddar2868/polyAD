import "server-only";
import { db } from "@/lib/supabase/server";

export type TeamMember = { id: number; email: string; isAdmin: boolean; createdAt: string };

/** The workspace owner (admin) first, then every member they added. */
export async function loadTeam(workspaceId: number): Promise<TeamMember[]> {
  const { data } = await db().from("users").select("id, email, is_admin, created_at, owner_id").or(`id.eq.${workspaceId},owner_id.eq.${workspaceId}`).order("id");
  return (data ?? []).map((u) => ({ id: u.id, email: u.email, isAdmin: Boolean(u.is_admin), createdAt: u.created_at }));
}
