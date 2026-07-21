import { KNOWLEDGE, type KnowledgeEntry } from "./index";

/**
 * Lightweight lexical retrieval over the knowledge base — no vector DB (per the
 * project's dependency constraints). Pure and deterministic → unit-testable.
 *
 * Scoring is calibrated to an intuitive 0..1 scale:
 * - each query token contributes the BEST field weight where it appears in the
 *   entry (keywords > examples/title > answer), so a strong keyword hit counts fully;
 * - query tokens that appear nowhere in the KB vocabulary are treated as noise
 *   and excluded (they don't drag a good match down);
 * - the linear coverage ratio is passed through a gentle curve so a clearly
 *   relevant top match lands around 0.7–1.0 and off-topic stays near 0.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "is", "are", "am",
  "do", "does", "i", "my", "me", "you", "your", "it", "as", "what", "how", "when",
  "can", "should", "with", "about", "so", "that", "this", "be", "will", "would",
  "if", "at", "by", "from", "we", "us", "our", "they", "them", "list", "things",
  "walk", "through", "tell", "need", "want", "please", "some", "any", "there",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9äöüß\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

const FIELD_WEIGHTS = { keywords: 3, questionExamples: 2, titleEn: 2, answerEn: 1 } as const;
const MAX_WEIGHT = 3;
const CURVE = 0.6; // score ** CURVE — lifts genuine partial matches into an intuitive range

function entryText(entry: KnowledgeEntry, field: keyof typeof FIELD_WEIGHTS): string {
  if (field === "keywords") return entry.keywords.join(" ");
  if (field === "questionExamples") return entry.questionExamples.join(" ");
  return entry[field];
}

/** Precompute, per entry, the best field weight available for each token. */
const ENTRY_TOKEN_WEIGHTS: Map<string, Map<string, number>> = new Map();
const VOCAB = new Set<string>();
for (const entry of KNOWLEDGE) {
  const weights = new Map<string, number>();
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS) as [keyof typeof FIELD_WEIGHTS, number][]) {
    for (const tok of tokenize(entryText(entry, field))) {
      VOCAB.add(tok);
      if ((weights.get(tok) ?? 0) < weight) weights.set(tok, weight);
    }
  }
  ENTRY_TOKEN_WEIGHTS.set(entry.entryId, weights);
}

export interface Retrieved {
  entry: KnowledgeEntry;
  score: number;
}

function scoreEntry(effectiveTokens: string[], entry: KnowledgeEntry): number {
  if (effectiveTokens.length === 0) return 0;
  const weights = ENTRY_TOKEN_WEIGHTS.get(entry.entryId)!;
  let num = 0;
  for (const t of effectiveTokens) num += weights.get(t) ?? 0;
  const linear = num / (effectiveTokens.length * MAX_WEIGHT);
  return Math.pow(linear, CURVE);
}

/** Return the top-k entries by relevance, highest first (scores in [0,1]). */
export function retrieve(query: string, k = 3): Retrieved[] {
  // Only keep query tokens that exist somewhere in the KB; unknown words are noise.
  const effective = [...new Set(tokenize(query))].filter((t) => VOCAB.has(t));
  return KNOWLEDGE.map((entry) => ({ entry, score: scoreEntry(effective, entry) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
