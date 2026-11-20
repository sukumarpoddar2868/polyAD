import "server-only";
import type { Client } from "@/features/clients/data";
import { todayIn } from "@/features/dashboard/metrics";
import { actId } from "@/features/meta-connect/discovery";
import { getConnectionToken } from "@/features/meta-connect/store";
import { graphGet, graphList } from "@/lib/meta/graph";
import { allowance, GST_RATE, type Allowance } from "./limits.ts";

/**
 * A candidate's Meta ad spend, live from the Insights API (nothing stored).
 * Counts the whole ad account (ads made outside PolyAd count too) from the
 * candidate's "count from" date.
 */

export type SpendSummary = Allowance & {
  currency: string;
  /** First day counted (YYYY-MM-DD), null = all time. */
  from: string | null;
  /** Spent ex-GST, as Meta reports it. */
  spentExGst: number;
  /** Campaigns that can still spend but have no spend cap — PolyAd can't count what they'll spend. */
  uncapped: string[];
};

/** Campaigns that may still spend: anything not archived, deleted or finished. */
const LIVE = ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED", "IN_PROCESS", "PENDING_REVIEW", "PREAPPROVED", "WITH_ISSUES", "PENDING_BILLING_INFO"];

type Campaign = { id: string; name?: string; spend_cap?: string; insights?: { data?: { spend?: string }[] } };

async function access(userId: number, client: Client) {
  if (!client.meta_connection_id || !client.ad_account_id) throw new Error("Connect this candidate's ad account first.");
  const token = await getConnectionToken(userId, client.meta_connection_id);
  if (!token) throw new Error("Facebook connection expired — reconnect on the candidate page.");
  return { token, act: actId(client.ad_account_id) };
}

const range = (from: string | null) =>
  from ? { time_range: JSON.stringify({ since: from, until: todayIn("Asia/Kolkata", new Date()) }) } : { date_preset: "maximum" };

export async function loadSpend(userId: number, client: Client): Promise<SpendSummary> {
  const { token, act } = await access(userId, client);
  const from = client.expense_from;
  const [account, total, campaigns] = await Promise.all([
    graphGet<{ currency?: string }>(act, token, { fields: "currency" }),
    graphGet<{ data?: { spend?: string }[] }>(`${act}/insights`, token, { fields: "spend", ...range(from) }),
    graphList<Campaign>(
      `${act}/campaigns`,
      token,
      { fields: "id,name,spend_cap,insights.date_preset(maximum){spend}", filtering: JSON.stringify([{ field: "effective_status", operator: "IN", value: LIVE }]) },
      5,
    ),
  ]);
  let committed = 0;
  const uncapped: string[] = [];
  for (const c of campaigns) {
    const cap = Number(c.spend_cap ?? 0) / 100;
    const spent = Number(c.insights?.data?.[0]?.spend ?? 0);
    if (cap > 0) committed += Math.max(0, cap - spent);
    else uncapped.push(c.name ?? c.id);
  }
  const spentExGst = Number(total.data?.[0]?.spend ?? 0);
  return { ...allowance(client.ad_budget_inr, spentExGst, committed), currency: account.currency ?? "INR", from, spentExGst, uncapped };
}

/** Day × campaign spend for the expense register, as CSV. */
export async function expenseCsv(userId: number, client: Client): Promise<string> {
  const { token, act } = await access(userId, client);
  const rows = await graphList<{ date_start?: string; campaign_id?: string; campaign_name?: string; spend?: string }>(
    `${act}/insights`,
    token,
    { level: "campaign", fields: "campaign_id,campaign_name,spend", time_increment: 1, ...range(client.expense_from), limit: 500 },
    20,
  );
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s;
  };
  const lines = [["Date", "Campaign ID", "Campaign", "Spend (₹, ex-GST)", `GST ${GST_RATE * 100}% (est.)`, "Total (₹)"].map(cell).join(",")];
  let sum = 0;
  for (const r of rows
    .filter((r) => Number(r.spend ?? 0) > 0)
    .sort((a, b) => (a.date_start ?? "").localeCompare(b.date_start ?? "") || (a.campaign_name ?? "").localeCompare(b.campaign_name ?? ""))) {
    const spend = Number(r.spend);
    sum += spend;
    lines.push([r.date_start ?? "", r.campaign_id ?? "", r.campaign_name ?? "", spend.toFixed(2), (spend * GST_RATE).toFixed(2), (spend * (1 + GST_RATE)).toFixed(2)].map(cell).join(","));
  }
  lines.push(["Total", "", "", sum.toFixed(2), (sum * GST_RATE).toFixed(2), (sum * (1 + GST_RATE)).toFixed(2)].map(cell).join(","));
  return "﻿" + lines.join("\r\n") + "\r\n";
}
