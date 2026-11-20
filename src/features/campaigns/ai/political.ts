/**
 * Political ad copy: languages, the election-law brief the AI writes under,
 * and a keyword check run on AI output and again at launch. Pure — used on the
 * server, in the wizard and in tests.
 *
 * Law behind the rules: RPA 1951 s.123 (corrupt practices: appeals on religion,
 * caste, community or language; bribery; false statements about a candidate),
 * the ECI Model Code of Conduct (no personal attacks, no use of defence forces)
 * and Meta's policy for ads about elections or politics.
 */

export const COPY_LANGUAGES = ["hi", "hinglish", "en"] as const;
export type CopyLanguage = (typeof COPY_LANGUAGES)[number];

export const LANGUAGE_INFO: Record<CopyLanguage, { label: string; brief: string }> = {
  hi: {
    label: "हिंदी",
    brief:
      "Write every voter-facing text in Hindi, Devanagari script, with simple everyday words people in Uttar Pradesh use (not formal or Sanskritised Hindi). Write the candidate's, party's and constituency's names in Devanagari too; an Independent candidate is \"निर्दलीय\". Name the election symbol by its usual Hindi word for the SAME object (Lantern → लालटेन, Bicycle → साइकिल, Lotus → कमल, Elephant → हाथी, Hand → हाथ का पंजा) — never a different object. campaign_name stays in English (internal only).",
  },
  hinglish: {
    label: "Hinglish",
    brief:
      "Write every voter-facing text in Hindi using the Latin (Roman) script, the way people type on WhatsApp (e.g. \"Aapka vote, aapka vikas\"). campaign_name stays in English.",
  },
  en: { label: "English", brief: "Write in simple English for voters in Uttar Pradesh." },
};

export type CandidateBrief = {
  name: string;
  party: string;
  symbol: string | null;
  seat: { no: number; name: string; district: string } | null;
};

/** The rules every political prompt carries. */
export const ELECTION_RULES = `ELECTION LAW — India (RPA 1951 s.123, ECI Model Code of Conduct, Meta policy). NEVER:
  • ask for votes, or praise/blame anyone, on the basis of religion, caste, community, language or region;
    no gods, religious places, religious slogans or religious symbols;
  • attack anyone personally (private life, family, character, name-calling) — criticise only policies and public record;
  • state any number, statistic, achievement, scheme or promise that is not in the brief below — never invent facts;
  • offer or hint at money, gifts, liquor or any favour in return for votes;
  • mention the armed forces, soldiers or military operations;
  • spread fear, hatred or anything that divides people;
  • give polling dates, booth details or voting instructions unless they are in the brief.
DO: talk about the candidate, their work and plans from the brief, local issues and development, and ask for the vote respectfully.`;

export function candidateLines(c: CandidateBrief): string {
  return [
    `  Candidate: ${c.name}`,
    `  Party: ${c.party}`,
    c.symbol ? `  Election symbol: ${c.symbol}` : null,
    c.seat ? `  Constituency: ${c.seat.name} (Assembly seat ${c.seat.no}), ${c.seat.district} district, Uttar Pradesh` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------ Guardrail check */

export type GuardrailCategory = "religion" | "caste" | "inducement" | "attack" | "forces";

export const GUARDRAIL_INFO: Record<GuardrailCategory, string> = {
  religion: "Religion — no religious appeals, places, gods or slogans",
  caste: "Caste or community — no appeals to caste or community",
  inducement: "Inducement — nothing that looks like money, gifts or liquor for votes",
  attack: "Personal attack — criticise policies, not people",
  forces: "Armed forces — not allowed in election ads",
};

/**
 * Latin terms match whole words; Devanagari terms match as substrings (no word
 * boundaries in Devanagari). Common surnames are deliberately left out — they
 * are candidates' names, not appeals.
 */
const TERMS: Record<GuardrailCategory, { latin: string[]; deva: string[] }> = {
  religion: {
    latin: ["hindu", "hindus", "hindutva", "muslim", "muslims", "musalman", "islam", "islamic", "christian", "christians", "sikh", "sikhs", "mandir", "masjid", "mosque", "temple", "church", "gurudwara", "allah", "quran", "bible", "gita", "kafir", "jihad", "jai shri ram", "jai shree ram", "allahu akbar", "har har mahadev", "dharm", "dharma", "mazhab", "sanatan"],
    deva: ["हिंदू", "हिन्दू", "मुस्लिम", "मुसलमान", "इस्लाम", "ईसाई", "मंदिर", "मन्दिर", "मस्जिद", "गिरजाघर", "गुरुद्वारा", "अल्लाह", "कुरान", "क़ुरान", "काफ़िर", "काफिर", "जिहाद", "जय श्री राम", "हर हर महादेव", "धर्म", "मज़हब", "मजहब", "सनातन"],
  },
  caste: {
    latin: ["caste", "castes", "casteist", "jati", "jaati", "brahmin", "brahmins", "kshatriya", "dalit", "dalits", "savarna", "obc", "biradari", "upper caste", "lower caste"],
    deva: ["जाति", "जात-पात", "ब्राह्मण", "क्षत्रिय", "दलित", "सवर्ण", "बिरादरी", "अगड़ा", "पिछड़ी जाति"],
  },
  inducement: {
    latin: ["liquor", "sharab", "daru", "daaru", "cash", "gift", "gifts", "vote ke badle", "in exchange for your vote", "money for votes"],
    deva: ["शराब", "दारू", "नकद", "तोहफा", "तोहफ़ा", "उपहार", "वोट के बदले", "पैसे बांट", "पैसे बाँट"],
  },
  attack: {
    latin: ["chor", "gunda", "goonda", "gaddar", "traitor", "deshdrohi", "corrupt", "liar", "criminal", "thief", "anti-national", "anti national"],
    deva: ["चोर", "गुंडा", "गुण्डा", "गद्दार", "देशद्रोही", "झूठा", "अपराधी", "बेईमान"],
  },
  forces: {
    latin: ["army", "soldier", "soldiers", "air force", "navy", "surgical strike", "sena ke jawan"],
    deva: ["भारतीय सेना", "सैनिक", "फ़ौज", "फौज", "सर्जिकल स्ट्राइक", "वायुसेना", "नौसेना"],
  },
};

export type GuardrailHit = { category: GuardrailCategory; term: string };

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS = (Object.keys(TERMS) as GuardrailCategory[]).flatMap((category) => [
  ...TERMS[category].latin.map((term) => ({ category, term, re: new RegExp(`(^|[^\\p{L}\\p{N}])${escape(term)}(?=$|[^\\p{L}\\p{N}])`, "iu") })),
  ...TERMS[category].deva.map((term) => ({ category, term, re: new RegExp(escape(term), "u") })),
]);

/**
 * Words in the texts that likely break election rules. `allow` = phrases that
 * are fine here (the candidate's own name, party, symbol, seat), removed first.
 */
export function guardrailHits(texts: (string | null | undefined)[], allow: (string | null | undefined)[] = []): GuardrailHit[] {
  let text = texts.filter(Boolean).join("\n").normalize("NFC");
  for (const a of allow) {
    const phrase = a?.trim();
    if (phrase && phrase.length > 1) text = text.replace(new RegExp(escape(phrase.normalize("NFC")), "giu"), " ");
  }
  const seen = new Set<string>();
  const out: GuardrailHit[] = [];
  for (const m of MATCHERS) {
    if (seen.has(m.term) || !m.re.test(text)) continue;
    seen.add(m.term);
    out.push({ category: m.category, term: m.term });
  }
  return out;
}

/** One line per category for messages: "Religion — …: mandir, dharm". */
export function describeHits(hits: GuardrailHit[]): string[] {
  const by = new Map<GuardrailCategory, string[]>();
  for (const h of hits) by.set(h.category, [...(by.get(h.category) ?? []), h.term]);
  return [...by].map(([c, terms]) => `${GUARDRAIL_INFO[c]}: ${terms.join(", ")}`);
}
