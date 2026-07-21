import type { DecisionResult } from "@/domain/schemas";
import type { Citation } from "@/domain/corpus";

/**
 * Client-side conversation model. The flow is deterministically scripted — each
 * assistant turn is app logic, never the LLM. The LLM only extracts fields.
 */
export type Step =
  | "intent"
  | "company_ask"
  | "company_confirm"
  | "legal"
  | "lineitems_ask"
  | "lineitems_confirm"
  | "assessing"
  | "decided"
  | "chat";

export type StaticCard =
  | { t: "decision"; decision: DecisionResult; citations: Citation[] }
  | { t: "invoiceReady"; id: string; invoiceNumber: string; status: string }
  | { t: "blocked"; decision: DecisionResult; citations: Citation[]; reviewCaseId: string | null };

export interface Msg {
  id: string;
  role: "assistant" | "user";
  kind: "text" | "card";
  text?: string;
  card?: StaticCard;
}

/** Assistant prompt shown when entering a step that expects free-text input. */
export const SCRIPT: Partial<Record<Step, string>> = {
  intent: "Hi! Tell me about the invoice you need — who are you billing and for what?",
  company_ask:
    "Who are you invoicing? Type the client's company details (name, country, VAT ID), or tap 📷 to scan a business card, contract, or invoice.",
  lineitems_ask:
    "What are you billing for? For example: “40 hours of web development at €95”.",
};

let counter = 0;
export function newId(): string {
  counter += 1;
  return `m${counter}_${Date.now().toString(36)}`;
}

export const CATEGORIES = [
  "software_development",
  "consulting",
  "design",
  "marketing",
  "translation",
  "research",
  "other_professional_service",
  "unsupported",
] as const;

export const CURRENCIES = ["EUR", "USD", "GBP", "CHF"] as const;
