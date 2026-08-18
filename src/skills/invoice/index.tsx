import type { DecisionResult } from "@/domain/schemas";
import type { Citation } from "@/domain/corpus";
import { DecisionCard } from "@/components/DecisionCard";
import { EscalatedAnswerCard } from "@/components/chat/AnswerCard";
import type { SkillDefinition } from "../types";
import { PRESETS } from "./examples";
import { BlockedCard, InvoiceReadyCard, SignupCard } from "./Cards";
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
  intro: "Hi! Ask me anything about invoicing a client — like whether you should charge VAT — and I'll work it out and get the invoice ready.",
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
    if (type === "signup") {
      const { variant } = props as { variant: "save" | "expert" };
      return <SignupCard variant={variant} />;
    }
    return null;
  },
};
