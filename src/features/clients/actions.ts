"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import { metaEnv } from "@/lib/env";
import { db } from "@/lib/supabase/server";
import { applyAssetSelection, type AssetFormState } from "@/features/meta-connect/assets";
import {
  createInvite,
  disconnectClient,
  linkClientToBusiness,
  markInviteUsed,
  removeBusinessConnection,
  resolveInvite,
} from "@/features/meta-connect/store";
import { importClients, type ImportState } from "./import";
import { INDEPENDENT } from "./political";
import {
  ClientLimitError,
  createClientRecord,
  deleteClientRecord,
  getClient,
  renameClient,
} from "./data";

/* ----------------------------------------------------------- Add client */

const AddClientSchema = z.object({
  businessName: z.string().trim().min(2, "Enter the candidate's name.").max(120),
});

export type AddClientState = { error?: string; fieldErrors?: { businessName?: string }; values?: { businessName?: string } };

export async function addClientAction(_prev: AddClientState, form: FormData): Promise<AddClientState> {
  const user = await requireUser();
  const parsed = AddClientSchema.safeParse(Object.fromEntries(form));
  const values = { businessName: String(form.get("businessName") ?? "") };
  if (!parsed.success) {
    const fe = parsed.error.issues.find((i) => i.path[0] === "businessName");
    return { fieldErrors: { businessName: fe?.message }, error: fe ? undefined : "Please check the form.", values };
  }
  let id: number;
  try {
    id = await createClientRecord(user, {
      businessName: parsed.data.businessName,
      // Not asked any more (nothing used it); stored with a neutral default.
      serviceModel: "agency_managed",
      billingArrangement: null,
    });
  } catch (e) {
    if (e instanceof ClientLimitError) return { error: `${e.message} Upgrade on the Account page to add more.`, values };
    return { error: "Could not add the candidate. Please try again.", values };
  }
  revalidatePath("/clients");
  redirect(`/clients/${id}`);
}

/* --------------------------------------------------- Per-client actions */

async function ownedClient(clientId: number) {
  const user = await requireUser();
  const client = await getClient(user.id, clientId);
  if (!client) redirect("/clients");
  return { user, client };
}

export async function renameClientAction(clientId: number, form: FormData) {
  const { user } = await ownedClient(clientId);
  const name = z.string().trim().min(2).max(120).safeParse(form.get("businessName"));
  if (name.success) await renameClient(user.id, clientId, name.data);
  revalidatePath(`/clients/${clientId}`);
}

export async function saveAssetsAction(clientId: number, _prev: AssetFormState, form: FormData): Promise<AssetFormState> {
  const { user, client } = await ownedClient(clientId);
  const res = await applyAssetSelection(user.id, client.id, client.meta_connection_id, form);
  if (res.saved) revalidatePath(`/clients/${clientId}`);
  return res;
}

export async function disconnectAction(clientId: number) {
  const { user, client } = await ownedClient(clientId);
  await disconnectClient(user.id, client.id, client.meta_connection_id);
  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClientAction(clientId: number) {
  const { user, client } = await ownedClient(clientId);
  if (client.is_self) return;
  await disconnectClient(user.id, client.id, client.meta_connection_id);
  await deleteClientRecord(user.id, client.id);
  revalidatePath("/clients");
  redirect("/clients");
}

export type InviteState = { url?: string; expiresAt?: string; error?: string };

export async function createInviteAction(clientId: number): Promise<InviteState> {
  const { user, client } = await ownedClient(clientId);
  try {
    const { token, expiresAt } = await createInvite(user.id, client.id);
    return { url: `${metaEnv().APP_URL}/connect/${token}`, expiresAt: expiresAt.toISOString() };
  } catch {
    return { error: "Could not create the invite link. Please try again." };
  }
}

/* ------------------------------------------- Invite (no Shryxa login) */

export async function saveInviteAssetsAction(token: string, _prev: AssetFormState, form: FormData): Promise<AssetFormState> {
  const invite = await resolveInvite(token);
  if (!invite) return { error: "This invite link has expired. Ask for a new one." };
  if (invite.usedAt) return { error: "This invite was already completed. Ask for a new link to make changes." };
  const res = await applyAssetSelection(invite.userId, invite.clientId, invite.connectionId, form);
  if (res.saved) {
    await markInviteUsed(invite.inviteId);
    revalidatePath(`/connect/${token}`);
    revalidatePath(`/clients/${invite.clientId}`);
  }
  return res;
}

/* ------------------------------------------- Business Manager (path B) */

async function requireAgency() {
  const user = await requireUser();
  if (user.accountType !== "agency") redirect("/clients");
  return user;
}

export async function importClientsAction(connectionId: number, _prev: ImportState, form: FormData): Promise<ImportState> {
  const user = await requireAgency();
  const res = await importClients(user, connectionId, form);
  revalidatePath("/clients");
  revalidatePath(`/clients/business/${connectionId}`);
  return res;
}

export async function linkBusinessAction(clientId: number, form: FormData) {
  const { user, client } = await ownedClient(clientId);
  if (user.accountType !== "agency") return;
  const connectionId = Number(form.get("connectionId"));
  // Drop the client's own login (if any) before switching to the shared one.
  if (client.meta_connection_id) await disconnectClient(user.id, client.id, client.meta_connection_id);
  await linkClientToBusiness(user.id, client.id, connectionId);
  revalidatePath(`/clients/${clientId}`);
}

export async function removeBusinessAction(connectionId: number) {
  const user = await requireAgency();
  await removeBusinessConnection(user.id, connectionId);
  revalidatePath("/clients");
  redirect("/clients");
}

/* ------------------------------------------------ Candidate profile */

const ProfileSchema = z.object({
  candidateName: z.string().trim().min(2, "Enter the candidate's name.").max(120),
  party: z.string().trim().max(120),
  symbol: z.string().trim().max(80),
  acNo: z.coerce.number().int().min(1, "Pick a constituency.").max(403),
  paidForBy: z.string().trim().max(200),
  politicalReady: z.literal("on").optional(),
});

export type ProfileState = { ok?: boolean; error?: string };

export async function saveProfileAction(clientId: number, _prev: ProfileState, form: FormData): Promise<ProfileState> {
  const { user, client } = await ownedClient(clientId);
  const p = ProfileSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form." };
  const d = p.data;
  if (d.politicalReady && !d.paidForBy) return { error: "Add the “Paid for by” text before confirming the Page is authorized." };
  const party = d.party && d.party.toLowerCase() !== INDEPENDENT.toLowerCase() ? d.party : null;
  const { error } = await db()
    .from("clients")
    .update({
      candidate_name: d.candidateName,
      party,
      symbol: d.symbol || null,
      ac_no: d.acNo,
      paid_for_by: d.paidForBy || null,
      // Keep the original confirmation time; clear it when unticked.
      political_ready_at: d.politicalReady ? (client.political_ready_at ?? new Date().toISOString()) : null,
      // The candidate's name is the client's display name.
      business_name: d.candidateName,
    })
    .eq("id", client.id)
    .eq("user_id", user.id);
  if (error) return { error: "Could not save. Please try again." };
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  return { ok: true };
}
