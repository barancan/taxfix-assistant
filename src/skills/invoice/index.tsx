import type { DecisionResult } from "@/domain/schemas";
import type { Citation } from "@/domain/corpus";
import { DecisionCard } from "@/components/DecisionCard";
import { EscalatedAnswerCard } from "@/components/chat/AnswerCard";
import type { SkillDefinition } from "../types";
import { PRESETS } from "./examples";
import { BlockedCard, InvoiceReadyCard } from "./Cards";
import { useInvoiceSkill } from "./useInvoiceSkill";

/**
 * Skill #1: outgoing invoice creation.
 * Conversationally collects customer + legal confirmations + line items, then
 * asks the deterministic VAT engine for a decision and (if approved) generates
 * a compliant PDF invoice. Future skills (e.g. incoming-invoice review) follow
 * the same contract — see docs/skills.md.
 */
export const invoiceSkill: SkillDefinition = {
  id: "invoice",
  title: "Create an invoice",
  intro: "Hi! Tell me about the invoice you need — who are you billing and for what?",
  examples: PRESETS.map((p) => ({ id: p.id, label: p.label, sentence: p.sentence, outcome: p.outcome })),
  useSkill: useInvoiceSkill,
  renderCard(type, props) {
    if (type === "decision") {
      const { decision, citations } = props as { decision: DecisionResult; citations: Citation[] };
      return <DecisionCard decision={decision} citations={citations} />;
    }
    if (type === "blocked") {
      const { decision, citations, reviewCaseId } = props as {
        decision: DecisionResult;
        citations: Citation[];
        reviewCaseId: string | null;
      };
      return <BlockedCard decision={decision} citations={citations} reviewCaseId={reviewCaseId} />;
    }
    if (type === "invoiceReady") {
      const { id, invoiceNumber, status } = props as { id: string; invoiceNumber: string; status: string };
      return <InvoiceReadyCard id={id} invoiceNumber={invoiceNumber} status={status} />;
    }
    if (type === "escalated") {
      const { reviewCaseId } = props as { reviewCaseId: string | null };
      return <EscalatedAnswerCard reviewCaseId={reviewCaseId} />;
    }
    return null;
  },
};
