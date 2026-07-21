import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
 * Local persistence fallback used when Supabase env vars are absent. Metadata is
 * written to `.local-store/db.json` and generated PDFs to `.local-store/pdfs/…`
 * so invoices, history, and previews survive dev-server restarts. All disk I/O is
 * best-effort: on a read-only filesystem it silently degrades to memory-only.
 * (Never claims to be remote storage — the UI shows a "Local demo" banner.)
 */
const ROOT = join(process.cwd(), ".local-store");
const DB_FILE = join(ROOT, "db.json");
const PDF_DIR = join(ROOT, "pdfs");

interface Db {
  counters: Map<number, number>;
  invoices: Map<string, StoredInvoice>;
  reviews: Map<string, StoredReviewCase>;
  runs: DecisionRunRecord[];
}

function load(): Db {
  const empty: Db = { counters: new Map(), invoices: new Map(), reviews: new Map(), runs: [] };
  try {
    if (!existsSync(DB_FILE)) return empty;
    const raw = JSON.parse(readFileSync(DB_FILE, "utf8")) as {
      counters?: Record<string, number>;
      invoices?: StoredInvoice[];
      reviews?: StoredReviewCase[];
    };
    return {
      counters: new Map(Object.entries(raw.counters ?? {}).map(([k, v]) => [Number(k), v])),
      invoices: new Map((raw.invoices ?? []).map((i) => [i.id, i])),
      reviews: new Map((raw.reviews ?? []).map((r) => [r.id, r])),
      runs: [],
    };
  } catch {
    return empty;
  }
}

// Persist across HMR / requests within a process, and rehydrate from disk.
const g = globalThis as unknown as { __tfxLocalDb?: Db };
const db: Db = g.__tfxLocalDb ?? (g.__tfxLocalDb = load());

function persist(): void {
  try {
    mkdirSync(ROOT, { recursive: true });
    writeFileSync(
      DB_FILE,
      JSON.stringify({
        counters: Object.fromEntries(db.counters),
        invoices: [...db.invoices.values()],
        reviews: [...db.reviews.values()],
      }),
    );
  } catch {
    // read-only FS (e.g. serverless) → stay in memory
  }
}

function pdfPathFor(sessionId: string, invoiceId: string): string {
  return join(PDF_DIR, sessionId, `${invoiceId}.pdf`);
}

export class LocalStorageAdapter implements StorageAdapter {
  readonly mode = "local" as const;

  async allocateInvoiceNumber(year: number): Promise<number> {
    const next = (db.counters.get(year) ?? 0) + 1;
    db.counters.set(year, next);
    persist();
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
    persist();
    return inv;
  }

  async setInvoiceStatus(id: string, status: InvoiceStatus, pdfPath: string | null): Promise<void> {
    const inv = db.invoices.get(id);
    if (inv) {
      db.invoices.set(id, { ...inv, status, pdfPath });
      persist();
    }
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
    const file = pdfPathFor(sessionId, invoiceId);
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, bytes);
    } catch {
      // best-effort; getPdf will 404 if the write failed
    }
    return `${sessionId}/${invoiceId}.pdf`;
  }

  async getPdf(sessionId: string, invoiceId: string): Promise<Uint8Array | null> {
    const file = pdfPathFor(sessionId, invoiceId);
    try {
      if (!existsSync(file)) return null;
      return new Uint8Array(readFileSync(file));
    } catch {
      return null;
    }
  }

  async createReviewCase(
    rec: Omit<StoredReviewCase, "id" | "createdAt">,
  ): Promise<StoredReviewCase> {
    const review: StoredReviewCase = { ...rec, id: randomUUID(), createdAt: new Date().toISOString() };
    db.reviews.set(review.id, review);
    persist();
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
