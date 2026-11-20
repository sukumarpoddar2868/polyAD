import "server-only";
import { groqJson } from "@/lib/ai/groq";
import type { Currency, PolyadDestination } from "../engine/presets.ts";
import type { CtaType } from "../engine/schema.ts";
import {
  cardsPrompt,
  sanitizeCards,
  type CardIdea,
  fallbackCopy,
  sanitizeCopy,
  type CopySuggestion,
  politicalAudience,
  politicalCopyPrompt,
} from "./prompts.ts";
import { describeHits, guardrailHits, type CandidateBrief, type CopyLanguage, type GuardrailHit } from "./political.ts";

/** Every voter-facing string in a suggestion, for the guardrail check. */
export const copyTexts = (c: CopySuggestion) => [
  c.primary_text,
  c.headline,
  c.description,
  ...c.carousel_cards.flatMap((x) => [x.headline, x.description]),
  ...c.lead_questions,
  c.thank_you_message,
];

export const candidateAllow = (c: CandidateBrief) => [c.name, c.party, c.symbol, c.seat?.name, c.seat?.district];

/**
 * Political ad copy. Checked against the election rules; a draft that trips
 * them is rewritten once with the reasons, and any remaining hits are returned
 * so the team sees them (launch blocks until someone reviews them).
 */
export async function generatePoliticalCopy(p: {
  candidate: CandidateBrief;
  language: CopyLanguage;
  about: string;
  offer: string;
  currency: Currency;
  destination: PolyadDestination;
  ctas: readonly CtaType[];
  locationCount: number;
  fallbackName: string;
}): Promise<{ copy: CopySuggestion; fallback: boolean; flags: GuardrailHit[] }> {
  const base = politicalCopyPrompt(p);
  const allow = candidateAllow(p.candidate);
  let best: { copy: CopySuggestion; flags: GuardrailHit[] } | null = null;
  let prompt = base;
  for (let attempt = 0; attempt < 3 && !(best && !best.flags.length); attempt++) {
    try {
      const raw = JSON.parse(await groqJson(prompt, { maxTokens: 6000, temperature: 0.6 })) as Record<string, unknown>;
      const sane = sanitizeCopy(raw, p);
      if (!sane) continue;
      const copy = politicalAudience(sane);
      const flags = guardrailHits(copyTexts(copy), allow);
      if (!best || flags.length < best.flags.length) best = { copy, flags };
      if (flags.length) {
        prompt = `${base}\n\nYOUR PREVIOUS DRAFT BROKE THE ELECTION RULES:\n${describeHits(flags).map((l) => `  • ${l}`).join("\n")}\nRewrite it without those words or ideas.`;
      }
    } catch {
      // retry, then fall back
    }
  }
  if (best) return { ...best, fallback: false };
  const copy = politicalAudience(fallbackCopy({ ...p, businessName: p.candidate.name }));
  return { copy, fallback: true, flags: guardrailHits(copyTexts(copy), allow) };
}

/** Carousel card headlines/descriptions. Retries once; throws if nothing usable. */
export async function generateCards(p: {
  about: string;
  offer: string;
  destination: PolyadDestination;
  count: number;
  candidate: CandidateBrief;
  language: CopyLanguage;
}): Promise<CardIdea[]> {
  const prompt = cardsPrompt(p);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = JSON.parse(await groqJson(prompt, { maxTokens: 4000, temperature: 0.7 })) as { cards?: unknown };
      const cards = sanitizeCards(raw.cards, p.count);
      if (cards.length >= Math.min(2, p.count)) return cards;
    } catch {
      // retry
    }
  }
  throw new Error("The AI couldn't write the cards right now. Please try again.");
}
