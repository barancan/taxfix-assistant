import "server-only";
import { z } from "zod";
import {
  CustomerFactsSchema,
  CustomerEvidenceSchema,
  ServiceFactsSchema,
  TransactionFactsSchema,
  type DecisionInput,
  type DecisionResult,
} from "@/domain/schemas";
import { decide } from "@/domain/vat/engine";
import { getCitations, type Citation } from "@/domain/corpus";
import { getProfile, toProfileFacts } from "./profile";
import { getStorage } from "./storage";

/** Facts the client is allowed to supply. Profile facts are injected server-side. */
export const ClientFactsSchema = z.object({
  customer: CustomerFactsSchema,
  evidence: CustomerEvidenceSchema,
  service: ServiceFactsSchema,
  transaction: TransactionFactsSchema,
});
export type ClientFacts = z.infer<typeof ClientFactsSchema>;

export function buildDecisionInput(sessionId: string, facts: ClientFacts): DecisionInput {
  const profile = getProfile(sessionId);
  return {
    taxYear: Number(facts.transaction.invoiceDate.slice(0, 4)),
    profile: toProfileFacts(profile),
    ...facts,
  };
}

export interface DecisionOutcome {
  input: DecisionInput;
  decision: DecisionResult;
  citations: Citation[];
}

export function evaluate(sessionId: string, facts: ClientFacts): DecisionOutcome {
  const input = buildDecisionInput(sessionId, facts);
  const decision = decide(input); // authoritative; validates its own input+output
  const citations = getCitations(decision.sourceIds);
  return { input, decision, citations };
}

/** Persist an audit run and, for blocked/escalated decisions, a review case. */
export async function persistDecision(
  sessionId: string,
  facts: ClientFacts,
  decision: DecisionResult,
): Promise<{ reviewCaseId: string | null }> {
  const storage = getStorage();
  await storage.saveDecisionRun({
    sessionId,
    status: decision.status,
    decisionCode: decision.decisionCode,
    corpusVersion: "",
  });

  if (decision.status === "refused" || decision.status === "escalate") {
    const expertQuestion =
      decision.boundaryStatements.find((b) => b.startsWith("Question for a tax expert")) ??
      "Which VAT treatment applies to this transaction?";
    const review = await storage.createReviewCase({
      sessionId,
      reason: decision.boundaryStatements[0] ?? "Out of supported scope",
      decisionCode: decision.decisionCode,
      customerName: facts.customer.name,
      missingFacts: decision.missingFacts,
      escalationReasons: decision.escalationReasons,
      expertQuestion,
    });
    return { reviewCaseId: review.id };
  }
  return { reviewCaseId: null };
}
