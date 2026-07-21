import { z } from "zod";
import { getSource, type Citation } from "@/domain/corpus";
import { ASSISTANT_CHAT_SYSTEM_PROMPT } from "./prompts";

/**
 * Structured "answer" operation for generic user input.
 *
 * The model classifies the turn, may draft a short plain-English answer, states
 * a self-assessed confidence, and may reference sources — but ONLY by selecting
 * ids from the closed corpus allowlist we provide. The server drops any id not
 * in the committed corpus, so citations can never be invented.
 *
 * Trust boundary: the confidence value gates only whether a general-knowledge
 * answer is DISPLAYED (below the threshold it is suppressed and the subject is
 * raised to a human). It can only suppress answers; it never feeds tax
 * decisions, which remain exclusively the deterministic engine's.
 */

export const AnswerSchema = z.object({
  kind: z.enum(["invoice_request", "question", "other"]),
  answer: z.string(),
  confidence: z.number(),
  relatedSourceIds: z.array(z.string()),
});
export type AnswerResult = z.infer<typeof AnswerSchema>;

export const ANSWER_TOOL_NAME = "classify_and_answer";

export const ANSWER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    kind: {
      type: "string",
      enum: ["invoice_request", "question", "other"],
      description:
        "invoice_request: the user wants to create/send an invoice now. question: a general question. other: greetings/anything else.",
    },
    answer: {
      type: "string",
      description: "Plain-English reply (2-4 sentences). Empty string for invoice_request.",
    },
    confidence: {
      type: "number",
      description: "0..1 self-assessment of how reliable the answer is for this user.",
    },
    relatedSourceIds: {
      type: "array",
      items: { type: "string" },
      description: "Source ids chosen ONLY from the provided allowlist; [] when none apply.",
    },
  },
  required: ["kind", "answer", "confidence", "relatedSourceIds"],
} as const;

/**
 * Build the answer prompt around retrieved grounding. The model may answer ONLY
 * from the grounding and may cite ONLY the source ids listed there — so answers
 * are grounded in curated, official-source-backed material rather than the
 * model's free memory. When nothing is retrieved it must defer (low confidence).
 */
export function answerSystemPrompt(grounding: string, context?: string): string {
  const groundingBlock = grounding.trim()
    ? `Grounding (authoritative — answer ONLY from this material, and cite ONLY the source ids listed here):
${grounding.trim()}

If the grounding does not actually cover the user's question, do NOT answer from your own knowledge — set confidence below 0.4 and relatedSourceIds [].`
    : `No official grounding was retrieved for this message. If it is a general question you cannot answer from official sources, set confidence below 0.4 and relatedSourceIds [] (a human expert will take it).`;

  const base = `${ASSISTANT_CHAT_SYSTEM_PROMPT}

Classify the user's latest message and respond via the structured schema:
- kind="invoice_request" when they want to create/send an invoice now (then leave answer empty).
- kind="question" for general questions; answer briefly (2–4 sentences, plain English).
- kind="other" for greetings/small talk; reply warmly and briefly.

${groundingBlock}

Citation rules (strict): NEVER invent a source, section, date, or id. Use only ids present in the grounding above.

Confidence rules:
- confidence is your honest 0..1 estimate of the answer's reliability for this user.
- Be LOW (< 0.5) for anything deadline-specific, amount-specific, case-specific, or not covered by the grounding.
- Personal tax outcomes always warrant low confidence — a human expert should take those.`;
  return context ? `${base}\n\nSession context (reference only): ${context}` : base;
}

export interface SanitizedAnswer extends AnswerResult {
  citations: Citation[];
}

/** Validate + defang a raw model answer: clamp confidence, drop unknown source ids. */
export function sanitizeAnswer(raw: unknown): SanitizedAnswer | null {
  const parsed = AnswerSchema.safeParse(raw);
  if (!parsed.success) return null;
  const a = parsed.data;
  const validIds = a.relatedSourceIds.filter((id) => getSource(id) !== undefined);
  const confidence = Math.min(1, Math.max(0, a.confidence));
  return {
    ...a,
    confidence,
    relatedSourceIds: validIds,
    citations: [], // filled by the route via getCitations(validIds)
  };
}

/** The display gate: true → show the answer; false → raise to a human. */
export function passesThreshold(confidence: number, threshold: number): boolean {
  return confidence >= threshold;
}
