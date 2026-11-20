/**
 * Election expenditure for a candidate's Meta ads. Pure — used at launch, on
 * the candidate page and in tests.
 *
 * Meta's "spend" excludes tax; Indian advertisers also pay 18% GST on it, and
 * the amount actually paid is what goes in the candidate's expense account.
 * Budgets here are in rupees incl. GST; Meta amounts are ex-GST.
 */

export const GST_RATE = 0.18;
/** ECI expense limit for a UP Assembly candidate (2022 revision). */
export const UP_AC_SPEND_LIMIT_INR = 40_00_000;

export const withGst = (exGst: number) => exGst * (1 + GST_RATE);
export const exGst = (incl: number) => incl / (1 + GST_RATE);

export type Allowance = {
  /** Ad budget incl. GST (the candidate's setting, or the whole ECI limit). */
  budget: number;
  /** Spent so far, incl. GST. */
  spent: number;
  /** Still allowed to spend on campaigns already on Meta (their spend caps), incl. GST. */
  committed: number;
  /** What a new campaign may still spend, ex-GST (Meta's units). Never negative. */
  headroom: number;
  /** spent / budget, 0–1+. */
  share: number;
  level: "ok" | "warn" | "critical" | "over";
};

/** spentExGst / committedExGst come from Meta (ex-GST, rupees). */
export function allowance(budgetInr: number | null, spentExGst: number, committedExGst: number): Allowance {
  const budget = budgetInr ?? UP_AC_SPEND_LIMIT_INR;
  const spent = withGst(spentExGst);
  const committed = withGst(committedExGst);
  const headroom = Math.max(0, Math.floor(exGst(budget) - spentExGst - committedExGst));
  const share = budget > 0 ? spent / budget : 1;
  const level = share >= 1 ? "over" : share >= 0.9 ? "critical" : share >= 0.75 ? "warn" : "ok";
  return { budget, spent, committed, headroom, share, level };
}

/** Meta's smallest campaign spend cap in India (₹100). */
export const MIN_SPEND_CAP_INR = 100;

export type BudgetCheck = { ok: true; capTo: number | null } | { ok: false; message: string };

/**
 * Can a new campaign fit? `plannedMax` = the most it can spend (its Meta spend
 * cap), ex-GST. A lifetime budget must fit as is; a daily budget runs under a
 * spend cap lowered to the headroom (`capTo`) as long as one day fits.
 */
export function checkNewCampaign(a: Allowance, plan: { budgetType: "daily" | "lifetime"; amount: number; plannedMax: number }): BudgetCheck {
  const rupees = (n: number) => `₹${Math.floor(n).toLocaleString("en-IN")}`;
  const left = `${rupees(a.headroom)} + GST left of the ${rupees(a.budget)} ad budget`;
  if (a.headroom < MIN_SPEND_CAP_INR) return { ok: false, message: `The candidate's ad budget is used up (${left}, counting what running campaigns may still spend). Raise the budget on the candidate page, or stop other campaigns.` };
  if (plan.plannedMax <= a.headroom) return { ok: true, capTo: null };
  if (plan.budgetType === "lifetime") return { ok: false, message: `This budget would go over the candidate's ad budget: ${left}. Lower it to ${rupees(a.headroom)} or less.` };
  if (plan.amount > a.headroom) return { ok: false, message: `Not even one day fits: ${left}. Lower the daily budget to ${rupees(a.headroom)} or less.` };
  return { ok: true, capTo: a.headroom };
}
