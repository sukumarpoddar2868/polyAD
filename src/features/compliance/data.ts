import "server-only";
import { db } from "@/lib/supabase/server";
import type { McmcCertificateRow, PollScheduleRow } from "@/lib/supabase/types";

export async function listCertificates(userId: number, clientId: number): Promise<McmcCertificateRow[]> {
  const { data } = await db()
    .from("mcmc_certificates")
    .select("*")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("issued_on", { ascending: false })
    .order("id", { ascending: false });
  return data ?? [];
}

export async function getCertificate(userId: number, id: number): Promise<McmcCertificateRow | null> {
  if (!Number.isSafeInteger(id)) return null;
  const { data } = await db().from("mcmc_certificates").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data;
}

export async function listSchedule(userId: number): Promise<PollScheduleRow[]> {
  const { data } = await db().from("poll_schedule").select("*").eq("user_id", userId).order("ac_no");
  return data ?? [];
}

export async function scheduleFor(userId: number, seats: number[]): Promise<PollScheduleRow[]> {
  if (!seats.length) return [];
  const { data } = await db().from("poll_schedule").select("*").eq("user_id", userId).in("ac_no", seats);
  return data ?? [];
}

/** Every certificate in the workspace (the campaign wizard groups them per candidate). */
export async function listAllCertificates(userId: number): Promise<McmcCertificateRow[]> {
  const { data } = await db().from("mcmc_certificates").select("*").eq("user_id", userId).order("issued_on", { ascending: false }).limit(2000);
  return data ?? [];
}
