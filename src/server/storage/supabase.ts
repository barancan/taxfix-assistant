import { CORPUS_VERSION } from "@/domain/corpus";
import { getEnv } from "@/config/env";
import type {
  DecisionRunRecord,
  NewInvoice,
  StorageAdapter,
  StoredInvoice,
  StoredReviewCase,
  InvoiceStatus,
} from "./types";

/**
 * Supabase-backed storage. Server-only (service-role key). PDFs live in a
 * PRIVATE bucket; downloads go through a protected server route / short-lived
 * signed URL. The client library is imported lazily so the local fallback never
 * loads it. Rows are mapped by hand to keep the schema explicit.
 */
type SupabaseClient = import("@supabase/supabase-js").SupabaseClient;

async function makeClient(): Promise<SupabaseClient> {
  const env = getEnv();
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(env.SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string, {
    auth: { persistSession: false },
  });
}

export class SupabaseStorageAdapter implements StorageAdapter {
  readonly mode = "supabase" as const;
  private clientPromise: Promise<SupabaseClient> | null = null;
  private bucket = getEnv().SUPABASE_STORAGE_BUCKET;

  private client(): Promise<SupabaseClient> {
    return (this.clientPromise ??= makeClient());
  }

  async allocateInvoiceNumber(year: number): Promise<number> {
    const sb = await this.client();
    const { data, error } = await sb.rpc("allocate_invoice_number", { p_year: year });
    if (error) throw new Error(`allocate_invoice_number failed: ${error.message}`);
    return data as number;
  }

  async createInvoice(rec: NewInvoice): Promise<StoredInvoice> {
    const sb = await this.client();
    const row = {
      session_id: rec.sessionId,
      invoice_number: rec.invoiceNumber,
      status: rec.status,
      decision_code: rec.decision.decisionCode,
      customer_name: rec.customerName,
      currency: rec.currency,
      subtotal_minor: rec.totals.subtotalMinor,
      vat_minor: rec.totals.vatMinor,
      total_minor: rec.totals.totalMinor,
      totals: rec.totals,
      fx: rec.fx,
    };
    const { data, error } = await sb.from("invoices").insert(row).select().single();
    if (error) throw new Error(`createInvoice failed: ${error.message}`);
    return mapInvoice(data);
  }

  async setInvoiceStatus(id: string, status: InvoiceStatus, pdfPath: string | null): Promise<void> {
    const sb = await this.client();
    const { error } = await sb
      .from("invoices")
      .update({ status, pdf_object_path: pdfPath })
      .eq("id", id);
    if (error) throw new Error(`setInvoiceStatus failed: ${error.message}`);
  }

  async listInvoices(sessionId: string): Promise<StoredInvoice[]> {
    const sb = await this.client();
    const { data, error } = await sb
      .from("invoices")
      .select()
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapInvoice);
  }

  async getInvoice(sessionId: string, id: string): Promise<StoredInvoice | null> {
    const sb = await this.client();
    const { data } = await sb
      .from("invoices")
      .select()
      .eq("session_id", sessionId)
      .eq("id", id)
      .maybeSingle();
    return data ? mapInvoice(data) : null;
  }

  async savePdf(sessionId: string, invoiceId: string, bytes: Uint8Array): Promise<string> {
    const sb = await this.client();
    const path = `${sessionId}/${invoiceId}.pdf`;
    const { error } = await sb.storage
      .from(this.bucket)
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (error) throw new Error(`savePdf failed: ${error.message}`);
    return path;
  }

  async getPdf(sessionId: string, invoiceId: string): Promise<Uint8Array | null> {
    const sb = await this.client();
    const path = `${sessionId}/${invoiceId}.pdf`;
    const { data, error } = await sb.storage.from(this.bucket).download(path);
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }

  async createReviewCase(
    rec: Omit<StoredReviewCase, "id" | "createdAt">,
  ): Promise<StoredReviewCase> {
    const sb = await this.client();
    const { data, error } = await sb
      .from("review_cases")
      .insert({
        session_id: rec.sessionId,
        reason: rec.reason,
        decision_code: rec.decisionCode,
        customer_name: rec.customerName,
        missing_facts: rec.missingFacts,
        escalation_reasons: rec.escalationReasons,
        expert_question: rec.expertQuestion,
      })
      .select()
      .single();
    if (error) throw new Error(`createReviewCase failed: ${error.message}`);
    return mapReview(data);
  }

  async listReviewCases(sessionId: string): Promise<StoredReviewCase[]> {
    const sb = await this.client();
    const { data, error } = await sb
      .from("review_cases")
      .select()
      .eq("session_id", sessionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map(mapReview);
  }

  async saveDecisionRun(rec: Omit<DecisionRunRecord, "id" | "createdAt">): Promise<void> {
    const sb = await this.client();
    await sb.from("decision_runs").insert({
      session_id: rec.sessionId,
      status: rec.status,
      decision_code: rec.decisionCode,
      corpus_version: CORPUS_VERSION,
    });
  }
}

function mapInvoice(r: any): StoredInvoice {
  return {
    id: r.id,
    sessionId: r.session_id,
    invoiceNumber: r.invoice_number,
    status: r.status,
    decisionCode: r.decision_code,
    customerName: r.customer_name,
    currency: r.currency,
    subtotalMinor: String(r.subtotal_minor),
    vatMinor: String(r.vat_minor),
    totalMinor: String(r.total_minor),
    totals: r.totals,
    fx: r.fx ?? null,
    pdfPath: r.pdf_object_path ?? null,
    createdAt: r.created_at,
  };
}
function mapReview(r: any): StoredReviewCase {
  return {
    id: r.id,
    sessionId: r.session_id,
    reason: r.reason,
    decisionCode: r.decision_code,
    customerName: r.customer_name,
    missingFacts: r.missing_facts ?? [],
    escalationReasons: r.escalation_reasons ?? [],
    expertQuestion: r.expert_question,
    createdAt: r.created_at,
  };
}
