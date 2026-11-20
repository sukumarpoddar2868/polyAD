-- Candidate / party profile on each connected client (one client = one candidate's Page + ad account).
alter table polyad.clients
  add column candidate_name     text,
  add column party              text,        -- empty = Independent
  add column symbol             text,        -- election symbol, added once allotted (after nominations)
  add column ac_no              integer check (ac_no between 1 and 403),  -- UP Assembly seat contested
  add column paid_for_by        text,        -- the disclaimer set on the Page's political authorization
  add column political_ready_at timestamptz; -- team confirmed: Page authorized for political ads + disclaimer
