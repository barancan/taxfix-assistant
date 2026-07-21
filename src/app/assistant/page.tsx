"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DecisionResult } from "@/domain/schemas";
import type { Citation } from "@/domain/corpus";
import { DecisionCard } from "@/components/DecisionCard";
import { COUNTRY_OPTIONS, regionForCountry } from "@/lib/regions";
import { PRESETS, type Preset } from "@/lib/presets";
import { majorToMinor, minorToMajor } from "@/lib/format";
import { MODEL_ALLOWLIST } from "@/ai/models";
import type { ExtractionResult } from "@/ai/schema";
import type { ProviderName } from "@/ai/provider";

interface LineForm {
  description: string;
  quantity: string;
  unit: string;
  unitPriceMajor: string;
}

interface FormState {
  sentence: string;
  customerName: string;
  countryCode: string;
  customerType: "business" | "private" | "unknown";
  businessConfirmed: boolean;
  vatId: string;
  demoVies: boolean;
  serviceCategory: string;
  serviceDescription: string;
  currency: string;
  addressText: string;
  lines: LineForm[];
}

const CATEGORIES = [
  "software_development", "consulting", "design", "marketing", "translation", "research", "other_professional_service", "unsupported",
];

const today = () => new Date().toISOString().slice(0, 10);

function fromPreset(p: Preset): FormState {
  return {
    sentence: p.sentence,
    customerName: p.facts.customer.name,
    countryCode: p.facts.customer.countryCode,
    customerType: p.facts.customer.type,
    businessConfirmed: p.facts.evidence.businessStatusConfirmedByUser,
    vatId: p.facts.customer.vatId ?? "",
    demoVies: p.facts.evidence.vatIdCheck === "demo_vies",
    serviceCategory: p.facts.service.category,
    serviceDescription: p.facts.service.normalizedDescription,
    currency: p.draft.currency,
    addressText: p.customerAddressLines.join("\n"),
    lines: p.draft.lines.map((l) => ({
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPriceMajor: minorToMajor(l.unitPriceMinor),
    })),
  };
}

const EMPTY: FormState = {
  sentence: "",
  customerName: "",
  countryCode: "US",
  customerType: "business",
  businessConfirmed: false,
  vatId: "",
  demoVies: false,
  serviceCategory: "consulting",
  serviceDescription: "",
  currency: "EUR",
  addressText: "",
  lines: [{ description: "", quantity: "1", unit: "project", unitPriceMajor: "0.00" }],
};

interface DecisionResponse {
  decision: DecisionResult;
  citations: Citation[];
  reviewCaseId: string | null;
  storageMode: string;
}

export default function AssistantPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [decision, setDecision] = useState<DecisionResponse | null>(null);
  const [invoice, setInvoice] = useState<{ id: string; invoiceNumber: string; status: string } | null>(null);
  const [blocked, setBlocked] = useState<{ reviewCaseId: string | null; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [aiError, setAiError] = useState<{ userMessage: string; byokRecoverable: boolean } | null>(null);
  const [byokOpen, setByokOpen] = useState(false);
  const [byok, setByok] = useState<{ provider: ProviderName; model: string; apiKey: string }>({
    provider: "anthropic",
    model: "claude-sonnet-5",
    apiKey: "",
  });

  const region = useMemo(() => regionForCountry(form.countryCode), [form.countryCode]);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  function applyExtraction(x: ExtractionResult) {
    setForm((f) => ({
      ...f,
      customerName: x.customerName ?? f.customerName,
      countryCode: x.customerCountryCode ?? f.countryCode,
      vatId: x.customerVatId ?? f.vatId,
      serviceCategory: x.suggestedCategory ?? f.serviceCategory,
      serviceDescription: x.serviceDescription ?? f.serviceDescription,
      currency: x.currency ?? f.currency,
      customerType: "unknown", // AI never sets legal status — user must confirm
      businessConfirmed: false,
      addressText: x.customerAddressLines.length ? x.customerAddressLines.join("\n") : f.addressText,
      lines: x.lineItems.length
        ? x.lineItems.map((li) => ({ description: li.description, quantity: li.quantity ?? "1", unit: "unit", unitPriceMajor: li.unitPriceMajor ?? "0.00" }))
        : x.amountMajor
          ? [{ description: x.serviceDescription ?? "Service", quantity: "1", unit: "project", unitPriceMajor: x.amountMajor }]
          : f.lines,
    }));
  }

  async function extractWithAI() {
    setAiError(null);
    reset();
    setBusy(true);
    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: form.sentence, ...(byok.apiKey ? { byok } : {}) }),
      });
      const data = await res.json();
      if (data?.ok === true) {
        applyExtraction(data.data as ExtractionResult);
        setByokOpen(false);
      } else if (data?.ok === false) {
        setAiError({ userMessage: data.userMessage, byokRecoverable: data.byokRecoverable });
        if (data.byokRecoverable) setByokOpen(true);
      } else {
        setAiError({ userMessage: "Could not extract. Enter details manually below.", byokRecoverable: false });
      }
    } catch {
      setAiError({ userMessage: "Extraction failed. Enter details manually below.", byokRecoverable: false });
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDecision(null);
    setInvoice(null);
    setBlocked(null);
    setError(null);
  }

  function buildFacts() {
    return {
      customer: {
        name: form.customerName || "Customer",
        countryCode: form.countryCode,
        region,
        type: form.customerType,
        ...(form.vatId ? { vatId: form.vatId } : {}),
      },
      evidence: {
        vatIdCheck: region === "EU" && form.vatId ? (form.demoVies ? "demo_vies" : "format_only") : "none",
        ...(form.demoVies ? { vatIdFormatValid: true } : {}),
        businessStatusConfirmedByUser: form.businessConfirmed,
        source: "manual",
      },
      service: {
        category: form.serviceCategory,
        normalizedDescription: form.serviceDescription || form.lines[0]?.description || "Professional service",
        isGoods: false,
        supported: form.serviceCategory !== "unsupported",
      },
      transaction: {
        invoiceDate: today(),
        currency: form.currency,
        intermediaryInvolved: false,
        specialEstablishment: false,
        exceptionFlags: [],
      },
    };
  }

  async function getDecision() {
    reset();
    setBusy(true);
    try {
      const res = await fetch("/api/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts: buildFacts() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "decision_failed");
      setDecision(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        facts: buildFacts(),
        draft: {
          currency: form.currency,
          invoiceDate: today(),
          paymentTermsDays: 14,
          lines: form.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unitPriceMinor: majorToMinor(l.unitPriceMajor, form.currency === "JPY" ? 0 : 2),
            isReimbursable: false,
          })),
        },
        customerAddressLines: form.addressText.split("\n").map((s) => s.trim()).filter(Boolean),
      };
      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.status === 409) {
        setBlocked({ reviewCaseId: data.reviewCaseId, reason: data.reason });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "invoice_failed");
      setInvoice({ id: data.invoice.id, invoiceNumber: data.invoice.invoiceNumber, status: data.invoice.status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const label = "block text-xs font-semibold uppercase tracking-wide text-tf-gray mb-1";
  const input = "w-full rounded-tf border border-tf-divider px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Assistant</h1>
        <p className="mt-1 text-sm text-tf-gray">
          Describe the invoice you need. We confirm the details, verify the VAT treatment, and prepare the document.
        </p>
      </div>

      <textarea
        className={`${input} min-h-20`}
        placeholder="e.g. I need to invoice a client in the US for 12,000 USD."
        value={form.sentence}
        onChange={(e) => set({ sentence: e.target.value })}
        aria-label="Describe your invoice"
      />

      <div className="flex items-center gap-2">
        <button
          onClick={extractWithAI}
          disabled={busy || !form.sentence.trim()}
          className="rounded-full border border-tf-green/40 bg-tf-green-pale px-4 py-2 text-sm font-semibold text-tf-green-dark disabled:opacity-50"
        >
          {busy ? "Extracting…" : "Extract with AI"}
        </button>
        <span className="text-xs text-tf-gray">Uploaded content is sent to the AI provider for extraction and is not stored.</span>
      </div>

      {aiError ? (
        <div className="rounded-tf border border-tf-divider bg-tf-yellow-pale p-3 text-sm text-tf-amber" role="alert">
          {aiError.userMessage}
        </div>
      ) : null}

      {byokOpen ? (
        <div className="rounded-tf-lg border border-tf-divider bg-tf-surface p-4">
          <h3 className="text-sm font-bold">Use your own API key</h3>
          <p className="mt-1 text-xs text-tf-gray">
            Held in memory for this request only — never stored, logged, or kept after a refresh.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              className="rounded-tf border border-tf-divider px-2 py-2 text-sm"
              value={byok.provider}
              onChange={(e) => {
                const provider = e.target.value as ProviderName;
                setByok((b) => ({ ...b, provider, model: MODEL_ALLOWLIST[provider][0]!.id }));
              }}
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
            </select>
            <select
              className="rounded-tf border border-tf-divider px-2 py-2 text-sm"
              value={byok.model}
              onChange={(e) => setByok((b) => ({ ...b, model: e.target.value }))}
            >
              {MODEL_ALLOWLIST[byok.provider].map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <input
              type="password"
              className="col-span-2 rounded-tf border border-tf-divider px-3 py-2 text-sm"
              placeholder="API key (kept in memory only)"
              value={byok.apiKey}
              onChange={(e) => setByok((b) => ({ ...b, apiKey: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <button
            onClick={extractWithAI}
            disabled={busy || !byok.apiKey}
            className="mt-3 rounded-full bg-tf-green-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Retry with my key
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => { setForm(fromPreset(p)); reset(); }}
            className="rounded-full border border-tf-divider bg-tf-surface px-3 py-1.5 text-xs font-medium text-tf-ink active:scale-95"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="rounded-tf-lg border border-tf-divider bg-tf-surface p-4">
        <h2 className="mb-3 text-sm font-bold">Confirm the details</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className={label}>Customer name</label>
            <input className={input} value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} />
          </div>
          <div>
            <label className={label}>Country</label>
            <select className={input} value={form.countryCode} onChange={(e) => set({ countryCode: e.target.value })}>
              {COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>{c.name} ({c.code})</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-tf-gray">Region: {region}</p>
          </div>
          <div>
            <label className={label}>Customer is a…</label>
            <select className={input} value={form.customerType} onChange={(e) => set({ customerType: e.target.value as FormState["customerType"] })}>
              <option value="business">Business</option>
              <option value="private">Private individual</option>
              <option value="unknown">Not sure</option>
            </select>
          </div>
          {region === "EU" ? (
            <div className="col-span-2">
              <label className={label}>Customer VAT ID</label>
              <input className={input} value={form.vatId} onChange={(e) => set({ vatId: e.target.value })} placeholder="e.g. PT123456789" />
              <label className="mt-2 flex items-center gap-2 text-xs text-tf-gray">
                <input type="checkbox" checked={form.demoVies} onChange={(e) => set({ demoVies: e.target.checked })} />
                Use seeded “Demo verification” (mock VIES)
              </label>
            </div>
          ) : null}
          <div>
            <label className={label}>Service</label>
            <select className={input} value={form.serviceCategory} onChange={(e) => set({ serviceCategory: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Currency</label>
            <select className={input} value={form.currency} onChange={(e) => set({ currency: e.target.value })}>
              {["EUR", "USD", "GBP", "CHF"].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.businessConfirmed} onChange={(e) => set({ businessConfirmed: e.target.checked })} />
            I confirm the customer is acting as a business.
          </label>
          <div className="col-span-2">
            <label className={label}>Customer address (one line each)</label>
            <textarea className={`${input} min-h-16`} value={form.addressText} onChange={(e) => set({ addressText: e.target.value })} />
          </div>
        </div>

        <h3 className="mt-4 mb-2 text-sm font-bold">Line items</h3>
        {form.lines.map((l, i) => (
          <div key={i} className="mb-2 grid grid-cols-6 gap-2">
            <input className={`${input} col-span-3`} placeholder="Description" value={l.description}
              onChange={(e) => set({ lines: form.lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x) })} />
            <input className={input} placeholder="Qty" value={l.quantity}
              onChange={(e) => set({ lines: form.lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x) })} />
            <input className={`${input} col-span-2`} placeholder="Unit price" value={l.unitPriceMajor}
              onChange={(e) => set({ lines: form.lines.map((x, j) => j === i ? { ...x, unitPriceMajor: e.target.value } : x) })} />
          </div>
        ))}
        <button
          className="text-xs font-semibold text-tf-green-dark"
          onClick={() => set({ lines: [...form.lines, { description: "", quantity: "1", unit: "unit", unitPriceMajor: "0.00" }] })}
        >
          + Add line
        </button>
      </div>

      <button
        onClick={getDecision}
        disabled={busy}
        className="rounded-full bg-tf-green-strong px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Checking…" : "Get VAT decision"}
      </button>

      {error ? <p className="text-sm text-tf-danger" role="alert">{error}</p> : null}

      {decision ? (
        <>
          {decision.storageMode === "local" ? (
            <p className="rounded-tf bg-tf-yellow-pale px-3 py-2 text-xs text-tf-amber">
              Local demo persistence mode — data is not stored remotely.
            </p>
          ) : null}
          <DecisionCard decision={decision.decision} citations={decision.citations} />

          {decision.decision.status === "approved" ? (
            <button
              onClick={generate}
              disabled={busy}
              className="rounded-full bg-tf-green-strong px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Generating…" : "Review & generate invoice"}
            </button>
          ) : (
            <p className="rounded-tf border border-tf-divider p-3 text-sm text-tf-gray">
              No invoice is generated for this case.{" "}
              {decision.reviewCaseId ? (
                <Link href="/review" className="font-semibold text-tf-green-dark underline">A review case was created.</Link>
              ) : null}
            </p>
          )}
        </>
      ) : null}

      {blocked ? (
        <div className="rounded-tf-lg border border-red-200 bg-red-50 p-4 text-sm">
          <p className="font-semibold text-tf-danger">Invoice blocked</p>
          <p className="mt-1 text-tf-ink">{blocked.reason}</p>
          {blocked.reviewCaseId ? (
            <Link href="/review" className="mt-2 inline-block font-semibold text-tf-green-dark underline">
              View review case
            </Link>
          ) : null}
        </div>
      ) : null}

      {invoice ? (
        <div className="rounded-tf-lg border border-tf-green/30 bg-tf-green-pale p-4">
          <p className="font-semibold text-tf-green-dark">
            {invoice.status === "issued" ? "Invoice ready" : "Invoice recorded (generation failed)"}
          </p>
          <p className="mt-1 text-sm">Number: <span className="font-mono">{invoice.invoiceNumber}</span></p>
          {invoice.status === "issued" ? (
            <div className="mt-3 flex gap-2">
              <a href={`/api/invoices/${invoice.id}/pdf`} target="_blank" rel="noreferrer"
                className="rounded-full bg-tf-green-strong px-4 py-2 text-sm font-semibold text-white">
                Preview / download PDF
              </a>
              <Link href="/invoices" className="rounded-full border border-tf-divider px-4 py-2 text-sm font-semibold">
                History
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
