"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/dal";
import { getClient } from "@/features/clients/data";
import { db } from "@/lib/supabase/server";

export type BudgetState = { ok?: boolean; error?: string };

const Schema = z.object({
  budget: z.union([z.literal(""), z.coerce.number().int("Whole rupees only.").min(1000, "Set at least ₹1,000.").max(100_000_000)]),
  from: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
});

export async function saveBudgetAction(clientId: number, _prev: BudgetState, form: FormData): Promise<BudgetState> {
  const user = await requireUser();
  if (!(await getClient(user.id, clientId))) return { error: "Candidate not found." };
  const p = Schema.safeParse({ budget: String(form.get("budget") ?? "").replace(/[,\s₹]/g, ""), from: form.get("from") ?? "" });
  if (!p.success) return { error: p.error.issues[0]?.message ?? "Check the form." };
  const { error } = await db()
    .from("clients")
    .update({ ad_budget_inr: p.data.budget === "" ? null : p.data.budget, expense_from: p.data.from || null })
    .eq("id", clientId)
    .eq("user_id", user.id);
  if (error) return { error: "Could not save. Please try again." };
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
