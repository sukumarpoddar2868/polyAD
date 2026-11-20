-- Phase D: election expenditure per candidate.
--  ad_budget_inr: share of the candidate's ECI expense limit (₹40 lakh, UP Assembly) set aside
--                 for Meta ads, incl. 18% GST. null = use the whole limit.
--  expense_from:  date spending starts counting (usually the nomination date; RPA s.77 counts
--                 from nomination to result). null = all spend on the ad account.
alter table polyad.clients
  add column ad_budget_inr bigint check (ad_budget_inr between 1000 and 100000000),
  add column expense_from  date;
