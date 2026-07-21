import { KNOWLEDGE, type KnowledgeEntry } from "./index";

/**
 * Lightweight lexical retrieval over the knowledge base — no vector DB (per the
 * project's dependency constraints). Scores each entry by weighted term overlap
 * between the tokenized query and the entry's keywords, example questions,
 * title, and answer text. Pure and deterministic → unit-testable.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "on", "for", "is", "are", "am",
  "do", "does", "i", "my", "me", "you", "your", "it", "as", "what", "how", "when",
  "can", "should", "with", "about", "so", "that", "this", "be", "will", "would",
  "if", "at", "by", "from", "we", "us", "our", "they", "them",
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

export interface Retrieved {
  entry: KnowledgeEntry;
  score: number;
}

function fieldTokens(entry: KnowledgeEntry, field: keyof typeof FIELD_WEIGHTS): Set<string> {
  const text =
    field === "keywords"
      ? entry.keywords.join(" ")
      : field === "questionExamples"
        ? entry.questionExamples.join(" ")
        : entry[field];
  return new Set(tokenize(text));
}

function scoreEntry(queryTokens: string[], entry: KnowledgeEntry): number {
  if (queryTokens.length === 0) return 0;
  const unique = new Set(queryTokens);
  let raw = 0;
  let maxPerField = 0;
  for (const [field, weight] of Object.entries(FIELD_WEIGHTS) as [keyof typeof FIELD_WEIGHTS, number][]) {
    const tokens = fieldTokens(entry, field);
    let hits = 0;
    for (const q of unique) if (tokens.has(q)) hits += 1;
    raw += weight * hits;
    maxPerField += weight * unique.size;
  }
  // Normalize to [0,1] by the best achievable overlap for this query.
  return maxPerField === 0 ? 0 : raw / maxPerField;
}

/** Return the top-k entries by relevance, highest first (scores in [0,1]). */
export function retrieve(query: string, k = 3): Retrieved[] {
  const queryTokens = tokenize(query);
  return KNOWLEDGE.map((entry) => ({ entry, score: scoreEntry(queryTokens, entry) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
