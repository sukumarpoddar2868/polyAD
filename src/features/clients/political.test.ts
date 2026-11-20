import { test } from "node:test";
import assert from "node:assert/strict";
import { onboardingSteps, partyLabel, politicalGaps } from "./political.ts";

test("independent candidates show as Independent", () => {
  assert.equal(partyLabel(null), "Independent");
  assert.equal(partyLabel("  "), "Independent");
  assert.equal(partyLabel("Samajwadi Party (SP)"), "Samajwadi Party (SP)");
});

test("political readiness needs name, seat, disclaimer and confirmed authorization — not a party", () => {
  const ready = { candidate_name: "Ramesh Kumar", ac_no: 174, paid_for_by: "Ramesh Kumar", political_ready_at: "2026-11-20T00:00:00Z" };
  assert.deepEqual(politicalGaps(ready), []);
  assert.equal(politicalGaps({ ...ready, paid_for_by: null }).length, 1);
  assert.equal(politicalGaps({ candidate_name: null, ac_no: null, paid_for_by: null, political_ready_at: null }).length, 4);
});

test("onboarding walks details → Page → ad account → authorization → disclaimer", () => {
  const blank = { candidate_name: null, ac_no: null, paid_for_by: null, political_ready_at: null, page_id: null, ad_account_id: null };
  assert.deepEqual(onboardingSteps(blank, false).map((s) => s.state), ["todo", "todo", "todo", "todo", "todo"]);
  const done = { candidate_name: "Ramesh Kumar", ac_no: 174, paid_for_by: "Ramesh Kumar", political_ready_at: "2026-11-20T00:00:00Z", page_id: "1", ad_account_id: "act_1" };
  assert.ok(onboardingSteps(done, true).every((s) => s.state === "ok"));
  // A Page id without a live connection is not access.
  assert.equal(onboardingSteps(done, false).find((s) => s.key === "page")?.state, "todo");
});
