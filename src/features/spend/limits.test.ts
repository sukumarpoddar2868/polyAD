import { test } from "node:test";
import assert from "node:assert/strict";
import { allowance, checkNewCampaign } from "./limits.ts";

test("allowance counts GST and what running campaigns may still spend", () => {
  // ₹1,18,000 budget incl. GST = ₹1,00,000 ex-GST. Spent 50k, committed 20k → 30k left.
  const a = allowance(118_000, 50_000, 20_000);
  assert.equal(a.headroom, 30_000);
  assert.equal(Math.round(a.spent), 59_000);
  assert.equal(a.level, "ok");
  assert.equal(allowance(118_000, 80_000, 0).level, "warn");
  assert.equal(allowance(118_000, 101_000, 0).level, "over");
  assert.equal(allowance(118_000, 101_000, 0).headroom, 0);
  // No budget set → the whole ₹40 lakh limit.
  assert.equal(allowance(null, 0, 0).budget, 40_00_000);
});

test("new campaign: fits, gets capped, or is blocked", () => {
  const a = allowance(118_000, 50_000, 20_000); // 30k ex-GST left
  assert.deepEqual(checkNewCampaign(a, { budgetType: "daily", amount: 500, plannedMax: 15_000 }), { ok: true, capTo: null });
  assert.deepEqual(checkNewCampaign(a, { budgetType: "daily", amount: 2_000, plannedMax: 60_000 }), { ok: true, capTo: 30_000 });
  assert.equal(checkNewCampaign(a, { budgetType: "daily", amount: 40_000, plannedMax: 1_200_000 }).ok, false);
  assert.equal(checkNewCampaign(a, { budgetType: "lifetime", amount: 40_000, plannedMax: 40_000 }).ok, false);
  assert.equal(checkNewCampaign(allowance(118_000, 100_000, 0), { budgetType: "daily", amount: 50, plannedMax: 1_500 }).ok, false);
});
