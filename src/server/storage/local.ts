import { randomUUID } from "node:crypto";
import { CORPUS_VERSION } from "@/domain/corpus";
import type {
  DecisionRunRecord,
  NewInvoice,
  StorageAdapter,
  StoredInvoice,
  StoredReviewCase,
  InvoiceStatus,
} from "./types";

/**
 * In-memory local persistence fallback. Data lives for the life of the server
 * process (per browser session by id) — never claims to be remote storage. Used
 * automatically when Supabase env vars are absent, and in tests.
 */
interface Db {
  counters: Map<number, number>;
  invoices: Map<string, StoredInvoice>;
  pdfs: Map<string, Uint8Array>;
  reviews: Map<string, StoredReviewCase>;
  runs: DecisionRunRecord[];
}

// Persist across hot reloads / requests in the same process.
const g = globalThis as unknown as { __tfxLocalDb?: Db };
const db: Db =
  g.__tfxLocalDb ??
  (g.__tfxLocalDb = {
    counters: new Map(),
    invoices: new Map(),
    pdfs: new Map(),
    reviews: new Map(),
    runs: [],
  });

export class LocalStorageAdapter implements StorageAdapter {
  readonly mode = "local" as const;

  async allocateInvoiceNumber(year: number): Promise<number> {
    const next = (db.counters.get(year) ?? 0) + 1;
    db.counters.set(year, next);
    return next;
  }

  async createInvoice(rec: NewInvoice): Promise<StoredInvoice> {
    const inv: StoredInvoice = {
      id: randomUUID(),
      sessionId: rec.sessionId,
      invoiceNumber: rec.invoiceNumber,
      status: rec.status,
      decisionCode: rec.decision.decisionCode,
      customerName: rec.customerName,
      currency: rec.currency,
      subtotalMinor: rec.totals.subtotalMinor,
      vatMinor: rec.totals.vatMinor,
      totalMinor: rec.totals.totalMinor,
      totals: rec.totals,
      fx: rec.fx,
      pdfPath: null,
      createdAt: new Date().toISOString(),
    };
    db.invoices.set(inv.id, inv);
    return inv;
  }

  async setInvoiceStatus(id: string, status: InvoiceStatus, pdfPath: string | null): Promise<void> {
    const inv = db.invoices.get(id);
    if (inv) db.invoices.set(id, { ...inv, status, pdfPath });
  }

  async listInvoices(sessionId: string): Promise<StoredInvoice[]> {
    return [...db.invoices.values()]
      .filter((i) => i.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getInvoice(sessionId: string, id: string): Promise<StoredInvoice | null> {
    const inv = db.invoices.get(id);
    return inv && inv.sessionId === sessionId ? inv : null;
  }

  async savePdf(sessionId: string, invoiceId: string, bytes: Uint8Array): Promise<string> {
    const path = `${sessionId}/${invoiceId}.pdf`;
    db.pdfs.set(path, bytes);
    return path;
  }

  async getPdf(sessionId: string, invoiceId: string): Promise<Uint8Array | null> {
    return db.pdfs.get(`${sessionId}/${invoiceId}.pdf`) ?? null;
  }

  async createReviewCase(
    rec: Omit<StoredReviewCase, "id" | "createdAt">,
  ): Promise<StoredReviewCase> {
    const review: StoredReviewCase = { ...rec, id: randomUUID(), createdAt: new Date().toISOString() };
    db.reviews.set(review.id, review);
    return review;
  }

  async listReviewCases(sessionId: string): Promise<StoredReviewCase[]> {
    return [...db.reviews.values()]
      .filter((r) => r.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveDecisionRun(rec: Omit<DecisionRunRecord, "id" | "createdAt">): Promise<void> {
    db.runs.push({ ...rec, id: randomUUID(), createdAt: new Date().toISOString(), corpusVersion: CORPUS_VERSION });
  }
}
