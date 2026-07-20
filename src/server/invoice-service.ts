import "server-only";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { computeTotals } from "@/domain/invoice/totals";
import { InvoiceDraftSchema, type FxMetadata } from "@/domain/invoice/schema";
import { composeInvoice, type Party } from "@/pdf/model";
import { renderInvoicePdf } from "@/pdf/render";
import { buildFxMetadata, fetchReferenceRate } from "./ecb";
import { getProfile, toSupplierParty } from "./profile";
import { getStorage } from "./storage";
import { ClientFactsSchema, evaluate, persistDecision, type ClientFacts } from "./decision-service";
import type { StoredInvoice } from "./storage/types";

export const InvoicePayloadSchema = z.object({
  facts: ClientFactsSchema,
  draft: InvoiceDraftSchema,
  customerAddressLines: z.array(z.string()).default([]),
});
export type InvoicePayload = z.infer<typeof InvoicePayloadSchema>;

export type GenerateResult =
  | { ok: true; invoice: StoredInvoice }
  | { ok: false; blocked: true; reviewCaseId: string | null; decisionCode: string; reason: string };

function invoiceNumber(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
}

function customerParty(facts: ClientFacts, addressLines: string[]): Party {
  return {
    name: facts.customer.name,
    addressLines: addressLines.length ? addressLines : [facts.customer.countryCode],
    vatId: facts.customer.vatId,
  };
}

/**
 * Full generation orchestration. The engine decides first; a number is
 * allocated ONLY for an approved decision after validation. If rendering/storing
 * fails after allocation, the failed invoice is preserved (number not reused).
 */
export async function generateInvoice(sessionId: string, payload: InvoicePayload): Promise<GenerateResult> {
  const env = getEnv();
  const profile = getProfile(sessionId);
  const storage = getStorage();

  const { decision } = evaluate(sessionId, payload.facts);

  if (decision.status !== "approved" || !decision.invoiceGenerationAllowed) {
    const { reviewCaseId } = await persistDecision(sessionId, payload.facts, decision);
    return {
      ok: false,
      blocked: true,
      reviewCaseId,
      decisionCode: decision.decisionCode,
      reason: decision.boundaryStatements[0] ?? "Not permitted",
    };
  }

  const { draft } = payload;
  const totals = computeTotals(
    draft.lines,
    draft.currency,
    { showVat: decision.showGermanVat, vatRate: decision.germanVatRate },
    draft.invoiceDiscount,
  );

  // Foreign-currency EUR accounting metadata (never alters the billed amount).
  let fx: FxMetadata | null = null;
  if (draft.currency.toUpperCase() !== "EUR") {
    try {
      const obs = await fetchReferenceRate(draft.currency, draft.invoiceDate);
      fx = buildFxMetadata(totals.totalMinor, draft.currency, draft.invoiceDate, obs);
    } catch {
      fx = null; // ECB unavailable: proceed without the metadata rather than block
    }
  }

  const year = Number(draft.invoiceDate.slice(0, 4));
  const seq = await storage.allocateInvoiceNumber(year);
  const number = invoiceNumber(profile.invoiceNumberPrefix, year, seq);

  const vm = composeInvoice({
    decision,
    draft,
    totals,
    invoiceNumber: number,
    supplier: toSupplierParty(profile),
    customer: customerParty(payload.facts, payload.customerAddressLines),
    bank: profile.bank,
    language: profile.invoiceLanguage,
    fx,
    demoMode: env.DEMO_MODE,
  });

  // Persist the record first so a render/store failure is visible, not silent.
  const invoice = await storage.createInvoice({
    sessionId,
    invoiceNumber: number,
    status: "issued",
    decision,
    customerName: payload.facts.customer.name,
    currency: draft.currency,
    totals,
    fx,
  });

  try {
    const pdf = await renderInvoicePdf(vm);
    const path = await storage.savePdf(sessionId, invoice.id, pdf);
    await storage.setInvoiceStatus(invoice.id, "issued", path);
    return { ok: true, invoice: { ...invoice, pdfPath: path } };
  } catch {
    await storage.setInvoiceStatus(invoice.id, "generation_failed", null);
    return { ok: true, invoice: { ...invoice, status: "generation_failed" } };
  }
}
