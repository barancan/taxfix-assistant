import { formatMajor, money } from "@/domain/money/money";
import { getWording, type InvoiceLanguage } from "@/domain/invoice/wording";
import type { DecisionResult } from "@/domain/schemas";
import type { FxMetadata, InvoiceDraft, InvoiceTotals } from "@/domain/invoice/schema";

/**
 * Pure invoice view-model. Turns a verified decision + computed totals + parties
 * into everything the PDF renders. Mandatory legal wording is resolved from the
 * controlled templates only. No LLM, no I/O.
 */

export interface Party {
  name: string;
  addressLines: string[];
  taxNumber?: string;
  vatId?: string;
  email?: string;
}

export interface BankDetails {
  accountHolder: string;
  iban: string;
  bic: string;
  bankName: string;
}

export interface InvoiceLineView {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  lineTotal: string;
}

export interface InvoiceViewModel {
  demoMode: boolean;
  invoiceNumber: string;
  issueDate: string;
  serviceDate?: string;
  currency: string;
  supplier: Party;
  customer: Party;
  lines: InvoiceLineView[];
  subtotal: string;
  discount: string | null;
  taxable: string;
  vatRate: number | null;
  vat: string | null;
  total: string;
  showVat: boolean;
  treatmentLabel: string;
  legalNotes: string[];
  reportingHints: string[];
  paymentTermsDays: number;
  bank: BankDetails;
  notes?: string;
  fx: {
    eurAmount: string;
    rate: string;
    actualRateDate: string;
    series: string;
  } | null;
}

const TREATMENT_LABEL: Record<string, string> = {
  standard: "German VAT (standard rate)",
  exempt_kleinunternehmer: "VAT-exempt (small business, §19 UStG)",
  reverse_charge: "Reverse charge (recipient accounts for VAT)",
  not_taxable_de: "Not taxable in Germany",
  blocked: "Blocked",
};

export interface ComposeParams {
  decision: DecisionResult;
  draft: InvoiceDraft;
  totals: InvoiceTotals;
  invoiceNumber: string;
  supplier: Party;
  customer: Party;
  bank: BankDetails;
  language: InvoiceLanguage;
  fx: FxMetadata | null;
  demoMode: boolean;
}

export function composeInvoice(p: ComposeParams): InvoiceViewModel {
  const { decision, draft, totals, currency } = { ...p, currency: p.totals.currency };

  const lines: InvoiceLineView[] = draft.lines.map((l, i) => {
    const lineTotal = totals.lines[i]?.netMinor ?? "0";
    return {
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: formatMajor(money(l.unitPriceMinor, currency)),
      lineTotal: formatMajor(money(lineTotal, currency)),
    };
  });

  const legalNotes = decision.wordingIds.map((id) =>
    getWording(id, p.language, { vatRate: decision.germanVatRate ?? undefined }),
  );

  return {
    demoMode: p.demoMode,
    invoiceNumber: p.invoiceNumber,
    issueDate: draft.invoiceDate,
    serviceDate: draft.serviceDate,
    currency,
    supplier: p.supplier,
    customer: p.customer,
    lines,
    subtotal: formatMajor(money(totals.subtotalMinor, currency)),
    discount: totals.invoiceDiscountMinor !== "0" ? formatMajor(money(totals.invoiceDiscountMinor, currency)) : null,
    taxable: formatMajor(money(totals.taxableMinor, currency)),
    vatRate: totals.vatRate,
    vat: decision.showGermanVat ? formatMajor(money(totals.vatMinor, currency)) : null,
    total: formatMajor(money(totals.totalMinor, currency)),
    showVat: decision.showGermanVat,
    treatmentLabel: TREATMENT_LABEL[decision.vatTreatment] ?? decision.vatTreatment,
    legalNotes,
    reportingHints: decision.reportingHints,
    paymentTermsDays: draft.paymentTermsDays,
    bank: p.bank,
    notes: draft.notes,
    fx: p.fx
      ? {
          eurAmount: formatMajor(money(p.fx.eurAmountMinor, "EUR")),
          rate: p.fx.rate,
          actualRateDate: p.fx.actualRateDate,
          series: p.fx.ecbSeriesKey,
        }
      : null,
  };
}
