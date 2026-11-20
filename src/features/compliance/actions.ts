"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import { getClient } from "@/features/clients/data";
import { MEDIA_BUCKET } from "@/features/campaigns/media/rules";
import { getSeat, seatSummaries } from "@/features/constituencies/seats";
import { db } from "@/lib/supabase/server";
import { CERT_FILE } from "./rules";

export type FormState = { ok?: boolean; error?: string; saved?: number };

/* ------------------------------------------------------- MCMC certificates */

/** Signed URL the browser PUTs the certificate scan to. */
export async function createCertUploadAction(input: { clientId: number; contentType: string; size: number }): Promise<{ ok: true; path: string; signedUrl: string } | { ok: false; error: string }> {
  const user = await requireUser();
  const ext = CERT_FILE.types[input.contentType as keyof typeof CERT_FILE.types];
  if (!ext) return { ok: false, error: "Use a JPG or PNG scan or photo." };
  if (!(input.size > 0 && input.size <= CERT_FILE.maxBytes)) return { ok: false, error: `File is too large — ${CERT_FILE.label}.` };
  if (!(await getClient(user.id, input.clientId))) return { ok: false, error: "Candidate not found." };
  const path = `u${user.id}/c${input.clientId}/mcmc/${randomUUID()}.${ext}`;
  const { data, error } = await db().storage.from(MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Couldn't start the upload. Please try again." };
  return { ok: true, path, signedUrl: data.signedUrl };
}

const CertSchema = z.object({
  certNo: z.string().trim().min(1, "Add the certificate number.").max(80),
  committee: z.string().trim().min(1, "Add which committee issued it.").max(120),
  issuedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Add the issue date."),
  title: z.string().trim().min(1, "Say which ad / creative it certifies.").max(200),
  filePath: z.string().max(300).optional(),
});

export async function addCertificateAction(clientId: number, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const client = await getClient(user.id, clientId);
  if (!client) return { error: "Candidate not found." };
  const p = CertSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form." };
  const d = p.data;
  const filePath = d.filePath && d.filePath.startsWith(`u${user.id}/c${clientId}/mcmc/`) && !d.filePath.includes("..") ? d.filePath : null;
  const { error } = await db()
    .from("mcmc_certificates")
    .insert({ user_id: user.id, client_id: clientId, cert_no: d.certNo, committee: d.committee, issued_on: d.issuedOn, title: d.title, file_path: filePath });
  if (error) return { error: "Could not save. Please try again." };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function deleteCertificateAction(clientId: number, certId: number): Promise<void> {
  const user = await requireUser();
  const { data } = await db()
    .from("mcmc_certificates")
    .delete()
    .eq("id", certId)
    .eq("client_id", clientId)
    .eq("user_id", user.id)
    .select("file_path")
    .maybeSingle();
  if (data?.file_path) await db().storage.from(MEDIA_BUCKET).remove([data.file_path]);
  revalidatePath(`/clients/${clientId}`);
}

/* ------------------------------------------------------------ Poll schedule */

/** "174, 180-185" → seat numbers (1–403). null when something can't be read. */
function parseSeats(text: string): number[] | null {
  const out: number[] = [];
  for (const part of text.split(/[\s,]+/).filter(Boolean)) {
    const m = /^(\d{1,3})(?:-(\d{1,3}))?$/.exec(part);
    if (!m) return null;
    const a = Number(m[1]), b = Number(m[2] ?? m[1]);
    if (a < 1 || b > 403 || b < a) return null;
    for (let n = a; n <= b; n++) out.push(n);
  }
  return out;
}

const ScheduleSchema = z.object({
  phase: z.union([z.literal(""), z.coerce.number().int().min(1).max(10)]),
  pollDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Add the poll date."),
  pollEnd: z.string().regex(/^\d{2}:\d{2}$/, "Add the time polling closes."),
  seats: z.string().max(4000),
});

export async function saveScheduleAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const p = ScheduleSchema.safeParse({
    phase: form.get("phase") ?? "",
    pollDate: form.get("pollDate"),
    pollEnd: form.get("pollEnd"),
    seats: form.get("seats") ?? "",
  });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form." };
  const typed = parseSeats(p.data.seats);
  if (!typed) return { error: "Seats: use numbers 1–403, commas and ranges, e.g. 174, 180-185." };
  const districts = new Set(form.getAll("district").map(String));
  const fromDistricts = districts.size ? seatSummaries().filter((s) => districts.has(s.district)).map((s) => s.no) : [];
  const seats = [...new Set([...typed, ...fromDistricts])].filter((n) => getSeat(n));
  if (!seats.length) return { error: "Pick the districts or type the seat numbers this date applies to." };

  const now = new Date().toISOString();
  const { error } = await db()
    .from("poll_schedule")
    .upsert(
      seats.map((ac_no) => ({ user_id: user.id, ac_no, phase: p.data.phase === "" ? null : p.data.phase, poll_date: p.data.pollDate, poll_end: p.data.pollEnd, updated_at: now })),
      { onConflict: "user_id,ac_no" },
    );
  if (error) return { error: "Could not save. Please try again." };
  revalidatePath("/schedule");
  return { ok: true, saved: seats.length };
}

/** Remove the poll date for the given seats (one seat, or a whole date group). */
export async function clearScheduleAction(seats: number[]): Promise<void> {
  const user = await requireUser();
  const nos = seats.filter((n) => Number.isSafeInteger(n) && n >= 1 && n <= 403);
  if (nos.length) await db().from("poll_schedule").delete().eq("user_id", user.id).in("ac_no", nos);
  revalidatePath("/schedule");
}
