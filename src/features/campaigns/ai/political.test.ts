import { test } from "node:test";
import assert from "node:assert/strict";
import { describeHits, guardrailHits } from "./political.ts";
import { politicalAudience, politicalCopyPrompt, sanitizeCopy } from "./prompts.ts";

test("flags religion, caste, inducement, attacks and armed forces — Hindi and English", () => {
  const cats = (t: string) => [...new Set(guardrailHits([t]).map((h) => h.category))];
  assert.deepEqual(cats("मंदिर के लिए वोट दें"), ["religion"]);
  assert.deepEqual(cats("Vote for our biradari"), ["caste"]);
  assert.deepEqual(cats("वोट के बदले शराब"), ["inducement"]);
  assert.deepEqual(cats("Unka neta chor hai"), ["attack"]);
  assert.deepEqual(cats("Our army made us proud"), ["forces"]);
});

test("clean campaign text passes; whole words only in Latin script", () => {
  assert.deepEqual(guardrailHits(["हर वार्ड में साफ़ पानी और नया डिग्री कॉलेज। अपना वोट विकास को दें।", "Corruption-free, cashless offices"]), []);
  // "army" inside another word is not a hit.
  assert.deepEqual(guardrailHits(["Harmony and Armyworm control for farmers"]), []);
});

test("the candidate's own name, party and seat are never flagged", () => {
  const text = ["धर्मेंद्र सिंह को वोट दें"];
  assert.equal(guardrailHits(text).length, 1); // "धर्म" inside the name
  assert.deepEqual(guardrailHits(text, ["धर्मेंद्र सिंह"]), []);
});

test("describeHits groups terms per rule", () => {
  const lines = describeHits(guardrailHits(["mandir aur masjid, chor"]));
  assert.equal(lines.length, 2);
  assert.match(lines[0], /mandir, masjid/);
});

test("political prompt carries candidate, language, election rules; audience is fixed in code", () => {
  const prompt = politicalCopyPrompt({
    candidate: { name: "Ramesh Kumar", party: "Independent", symbol: "Lantern", seat: { no: 174, name: "Lucknow Central", district: "Lucknow" } },
    language: "hi",
    about: "Local teacher.",
    offer: "Clean water.",
    currency: "INR",
    destination: "none",
    ctas: ["LEARN_MORE"],
    locationCount: 12,
  });
  for (const s of ["Ramesh Kumar", "Lucknow Central", "Lantern", "Devanagari", "RPA 1951", "never invent facts"]) assert.ok(prompt.includes(s), s);
  const copy = sanitizeCopy({ primary_text: "x", headline: "y", interest_targeting: ["Politics"], age_min: 30, gender: "male", device_os: "ios" }, { currency: "INR", ctas: ["LEARN_MORE"], fallbackName: "n" })!;
  const fixed = politicalAudience(copy);
  assert.deepEqual([fixed.interest_targeting, fixed.age_min, fixed.gender, fixed.device_os], [[], 18, "any", "all"]);
});
