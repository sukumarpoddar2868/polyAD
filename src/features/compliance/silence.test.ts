import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSilence, metaIst, silenceWindow } from "./silence.ts";

const rows = [
  { ac_no: 174, phase: 1, poll_date: "2027-02-20", poll_end: "18:00:00" },
  { ac_no: 175, phase: 2, poll_date: "2027-02-27", poll_end: "17:00:00" },
];

test("silence window = 48 h ending at poll close, IST", () => {
  const w = silenceWindow("2027-02-20", "18:00:00");
  assert.equal(w.close.toISOString(), "2027-02-20T12:30:00.000Z");
  assert.equal(w.start.toISOString(), "2027-02-18T12:30:00.000Z");
  assert.equal(metaIst(w.start), "2027-02-18T18:00:00+05:30");
});

test("before the silence: no block, end capped at the earliest window", () => {
  const r = checkSilence([175, 174], rows, { now: new Date("2027-02-10T00:00:00Z") });
  assert.deepEqual(r.blocked, []);
  assert.equal(r.capAt?.acNo, 174);
  assert.equal(metaIst(r.capAt!.start), "2027-02-18T18:00:00+05:30");
  // An end date before the silence needs no cap.
  assert.equal(checkSilence([174], rows, { now: new Date("2027-02-10T00:00:00Z"), end: new Date("2027-02-15T00:00:00Z") }).capAt, null);
});

test("inside the silence: blocked; after polling: ignored; unknown seats reported", () => {
  const during = checkSilence([174, 175], rows, { now: new Date("2027-02-19T06:00:00Z") });
  assert.deepEqual(during.blocked.map((w) => w.acNo), [174]);
  const after = checkSilence([174, 175, 9], rows, { now: new Date("2027-02-21T00:00:00Z") });
  assert.deepEqual(after.blocked, []);
  assert.equal(after.capAt?.acNo, 175);
  assert.deepEqual(after.missing, [9]);
  // A scheduled start inside a window is blocked too.
  const late = checkSilence([174], rows, { now: new Date("2027-02-10T00:00:00Z"), start: new Date("2027-02-19T00:00:00Z") });
  assert.deepEqual(late.blocked.map((w) => w.acNo), [174]);
});
