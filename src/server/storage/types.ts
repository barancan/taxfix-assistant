import type { DecisionResult } from "@/domain/schemas";
import type { FxMetadata, InvoiceTotals } from "@/domain/invoice/schema";

export type StorageMode = "supabase" | "local";

export type InvoiceStatus = "issued" | "generation_failed";

export interface StoredInvoice {
  id: string;
  sessionId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  decisionCode: string;
  customerName: string;
  currency: string;
  subtotalMinor: string;
  vatMinor: string;
  totalMinor: string;
  totals: InvoiceTotals;
  fx: FxMetadata | null;
  pdfPath: string | null;
  createdAt: string;
}

export interface StoredReviewCase {
  id: string;
  sessionId: string;
  reason: string;
  decisionCode: string;
  customerName: string;
  missingFacts: string[];
  escalationReasons: string[];
  expertQuestion: string;
  createdAt: string;
}

export interface DecisionRunRecord {
  id: string;
  sessionId: string;
  status: string;
  decisionCode: string;
  corpusVersion: string;
  createdAt: string;
}

export interface NewInvoice {
  sessionId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  decision: DecisionResult;
  customerName: string;
  currency: string;
  totals: InvoiceTotals;
  fx: FxMetadata | null;
}

export interface StorageAdapter {
  readonly mode: StorageMode;
  allocateInvoiceNumber(year: number): Promise<number>;
  createInvoice(rec: NewInvoice): Promise<StoredInvoice>;
  setInvoiceStatus(id: string, status: InvoiceStatus, pdfPath: string | null): Promise<void>;
  listInvoices(sessionId: string): Promise<StoredInvoice[]>;
  getInvoice(sessionId: string, id: string): Promise<StoredInvoice | null>;
  savePdf(sessionId: string, invoiceId: string, bytes: Uint8Array): Promise<string>;
  getPdf(sessionId: string, invoiceId: string): Promise<Uint8Array | null>;
  createReviewCase(rec: Omit<StoredReviewCase, "id" | "createdAt">): Promise<StoredReviewCase>;
  listReviewCases(sessionId: string): Promise<StoredReviewCase[]>;
  saveDecisionRun(rec: Omit<DecisionRunRecord, "id" | "createdAt">): Promise<void>;
}
