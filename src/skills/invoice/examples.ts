import type { ClientFacts } from "@/server/decision-service";

export interface DraftInput {
  currency: string;
  lines: { description: string; quantity: string; unit: string; unitPriceMinor: string }[];
  paymentTermsDays: number;
}

export type PresetOutcome = "success" | "escalate" | "blocked";

export interface Preset {
  id: string;
  label: string;
  /** Expected engine outcome — drives the example-pill color in the chat UI. */
  outcome: PresetOutcome;
  sentence: string;
  facts: Omit<ClientFacts, "transaction"> & { transaction: Omit<ClientFacts["transaction"], "invoiceDate"> };
  draft: DraftInput;
  customerAddressLines: string[];
}

const baseTx = { currency: "EUR", intermediaryInvolved: false, specialEstablishment: false, exceptionFlags: [] as [] };

export const PRESETS: Preset[] = [
  {
    id: "us",
    outcome: "success",
    label: "Billing a US company",
    sentence: "Billing a US company, what goes on the invoice?",
    facts: {
      customer: { name: "Northwind US Inc.", countryCode: "US", region: "NON_EU", type: "business" },
      evidence: { vatIdCheck: "none", businessStatusConfirmedByUser: true, source: "manual" },
      service: { category: "consulting", normalizedDescription: "Product consulting engagement", isGoods: false, supported: true },
      transaction: { ...baseTx, currency: "USD" },
    },
    draft: { currency: "USD", paymentTermsDays: 14, lines: [{ description: "Product consulting engagement", quantity: "1", unit: "project", unitPriceMinor: "1200000" }] },
    customerAddressLines: ["Northwind US Inc.", "500 Market Street", "San Francisco, CA 94105", "United States"],
  },
  {
    id: "pt",
    outcome: "success",
    label: "VAT to Portugal?",
    sentence: "Do I charge VAT to a client in Portugal?",
    facts: {
      customer: { name: "Exemplo Unipessoal Lda", countryCode: "PT", region: "EU", type: "business", vatId: "PT123456789" },
      evidence: { vatIdFormatValid: true, vatIdCheck: "demo_vies", businessStatusConfirmedByUser: true, source: "manual" },
      service: { category: "software_development", normalizedDescription: "Custom web application development", isGoods: false, supported: true },
      transaction: { ...baseTx },
    },
    draft: { currency: "EUR", paymentTermsDays: 14, lines: [{ description: "Custom web application development", quantity: "40", unit: "hour", unitPriceMinor: "9500" }] },
    customerAddressLines: ["Exemplo Unipessoal Lda", "Av. da Liberdade 100", "1250-096 Lisboa", "Portugal"],
  },
  {
    id: "de",
    outcome: "success",
    label: "VAT to a German client?",
    sentence: "Do I need to charge VAT to a German client?",
    facts: {
      customer: { name: "Beispiel GmbH", countryCode: "DE", region: "DE", type: "business" },
      evidence: { vatIdCheck: "none", businessStatusConfirmedByUser: true, source: "manual" },
      service: { category: "consulting", normalizedDescription: "Product strategy consulting", isGoods: false, supported: true },
      transaction: { ...baseTx },
    },
    draft: { currency: "EUR", paymentTermsDays: 14, lines: [{ description: "Product strategy consulting", quantity: "20", unit: "hour", unitPriceMinor: "12000" }] },
    customerAddressLines: ["Beispiel GmbH", "Friedrichstraße 12", "10117 Berlin", "Germany"],
  },
  {
    id: "private",
    outcome: "blocked",
    label: "Billing a private customer?",
    sentence: "Can I invoice a private customer the same way as a business?",
    facts: {
      customer: { name: "John Private", countryCode: "DE", region: "DE", type: "private" },
      evidence: { vatIdCheck: "none", businessStatusConfirmedByUser: false, source: "manual" },
      service: { category: "consulting", normalizedDescription: "Personal coaching sessions", isGoods: false, supported: true },
      transaction: { ...baseTx },
    },
    draft: { currency: "EUR", paymentTermsDays: 14, lines: [{ description: "Personal coaching sessions", quantity: "3", unit: "session", unitPriceMinor: "15000" }] },
    customerAddressLines: ["John Private", "Musterweg 3", "10115 Berlin", "Germany"],
  },
  {
    id: "escalate",
    outcome: "escalate",
    label: "Selling an online course?",
    sentence: "Can I invoice a German company for an online course bundle with downloadable materials?",
    facts: {
      customer: { name: "Lernwerk GmbH", countryCode: "DE", region: "DE", type: "business" },
      evidence: { vatIdCheck: "none", businessStatusConfirmedByUser: true, source: "manual" },
      // Not classifiable as an ordinary professional service → engine escalates.
      service: { category: "unsupported", normalizedDescription: "Online course bundle with downloadable materials", isGoods: false, supported: false },
      transaction: { ...baseTx },
    },
    draft: { currency: "EUR", paymentTermsDays: 14, lines: [{ description: "Online course bundle", quantity: "1", unit: "bundle", unitPriceMinor: "80000" }] },
    customerAddressLines: ["Lernwerk GmbH", "Torstraße 20", "10119 Berlin", "Germany"],
  },
];
