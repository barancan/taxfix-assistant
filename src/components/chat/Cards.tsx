"use client";

import Link from "next/link";
import type { Collected } from "@/lib/facts";
import { CATEGORIES, CURRENCIES } from "@/lib/conversation";
import { COUNTRY_OPTIONS, regionForCountry } from "@/lib/regions";
import { DecisionCard } from "@/components/DecisionCard";
import { PdfPreview } from "@/components/PdfPreview";
import type { DecisionResult } from "@/domain/schemas";
import type { Citation } from "@/domain/corpus";
import type { ProviderName } from "@/ai/provider";
import { MODEL_ALLOWLIST } from "@/ai/models";

const cardCls = "rounded-tf-lg border border-tf-divider bg-tf-surface p-4";
const label = "block text-xs font-semibold uppercase tracking-wide text-tf-gray mb-1";
const input = "w-full rounded-tf border border-tf-divider px-3 py-2 text-sm";

type Patch = (p: Partial<Collected>) => void;

export function CompanyConfirmCard({ value, onPatch, onConfirm }: { value: Collected; onPatch: Patch; onConfirm: () => void }) {
  const region = regionForCountry(value.countryCode);
  return (
    <div className={cardCls}>
      <h3 className="mb-1 text-sm font-bold">Confirm the client&rsquo;s details</h3>
      <p className="mb-3 text-xs text-tf-gray">Please check what I extracted before we continue.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={label}>Company name</label>
          <input className={input} value={value.customerName} onChange={(e) => onPatch({ customerName: e.target.value })} />
        </div>
        <div>
          <label className={label}>Country</label>
          <select className={input} value={value.countryCode} onChange={(e) => onPatch({ countryCode: e.target.value })}>
            {COUNTRY_OPTIONS.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
          </select>
          <p className="mt-1 text-xs text-tf-gray">Region: {region}</p>
        </div>
        <div>
          <label className={label}>Currency</label>
          <select className={input} value={value.currency} onChange={(e) => onPatch({ currency: e.target.value })}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {region === "EU" ? (
          <div className="col-span-2">
            <label className={label}>VAT ID</label>
            <input className={input} value={value.vatId} onChange={(e) => onPatch({ vatId: e.target.value })} placeholder="e.g. PT123456789" />
          </div>
        ) : null}
        <div className="col-span-2">
          <label className={label}>Service</label>
          <select className={input} value={value.serviceCategory} onChange={(e) => onPatch({ serviceCategory: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className={label}>Client address (one line each)</label>
          <textarea className={`${input} min-h-16`} value={value.addressLines.join("\n")}
            onChange={(e) => onPatch({ addressLines: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
        </div>
      </div>
      <button onClick={onConfirm} className="mt-4 w-full rounded-full bg-tf-green-strong px-4 py-2.5 text-sm font-semibold text-white">
        Looks right — continue
      </button>
    </div>
  );
}

export function LegalConfirmCard({ value, onPatch, onConfirm }: { value: Collected; onPatch: Patch; onConfirm: () => void }) {
  const region = regionForCountry(value.countryCode);
  return (
    <div className={cardCls}>
      <h3 className="mb-1 text-sm font-bold">A couple of things I must confirm</h3>
      <p className="mb-3 text-xs text-tf-gray">These affect the tax treatment, so I can&rsquo;t assume them.</p>
      <label className={label}>This customer is a…</label>
      <div className="mb-3 flex gap-2">
        {(["business", "private"] as const).map((t) => (
          <button key={t} onClick={() => onPatch({ customerType: t })}
            className={`flex-1 rounded-tf border px-3 py-2 text-sm font-medium ${value.customerType === t ? "border-tf-green-strong bg-tf-green-pale text-tf-green-dark" : "border-tf-divider"}`}>
            {t === "business" ? "Business" : "Private individual"}
          </button>
        ))}
      </div>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={value.businessConfirmed} onChange={(e) => onPatch({ businessConfirmed: e.target.checked })} />
        I confirm the customer is acting as a business.
      </label>
      {region === "EU" ? (
        <label className="mb-3 flex items-center gap-2 text-xs text-tf-gray">
          <input type="checkbox" checked={value.demoVies} onChange={(e) => onPatch({ demoVies: e.target.checked })} />
          Use seeded &ldquo;Demo verification&rdquo; for the VAT ID (mock VIES)
        </label>
      ) : null}
      <button onClick={onConfirm} className="mt-1 w-full rounded-full bg-tf-green-strong px-4 py-2.5 text-sm font-semibold text-white">
        Confirm
      </button>
    </div>
  );
}

export function LineItemsCard({ value, onPatch, onConfirm }: { value: Collected; onPatch: Patch; onConfirm: () => void }) {
  const lines = value.lines.length ? value.lines : [{ description: "", quantity: "1", unit: "unit", unitPriceMajor: "0.00" }];
  const setLine = (i: number, patch: Partial<Collected["lines"][number]>) =>
    onPatch({ lines: lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  return (
    <div className={cardCls}>
      <h3 className="mb-3 text-sm font-bold">Line items</h3>
      {lines.map((l, i) => (
        <div key={i} className="mb-2 grid grid-cols-6 gap-2">
          <input className={`${input} col-span-3`} placeholder="Description" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
          <input className={input} placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} />
          <input className={`${input} col-span-2`} placeholder="Unit price" value={l.unitPriceMajor} onChange={(e) => setLine(i, { unitPriceMajor: e.target.value })} />
        </div>
      ))}
      <button className="text-xs font-semibold text-tf-green-dark" onClick={() => onPatch({ lines: [...lines, { description: "", quantity: "1", unit: "unit", unitPriceMajor: "0.00" }] })}>
        + Add line
      </button>
      <button onClick={() => { onPatch({ lines }); onConfirm(); }} className="mt-3 w-full rounded-full bg-tf-green-strong px-4 py-2.5 text-sm font-semibold text-white">
        Assess &amp; continue
      </button>
    </div>
  );
}

export function InvoiceReadyCard({ id, invoiceNumber, status }: { id: string; invoiceNumber: string; status: string }) {
  const pdfUrl = `/api/invoices/${id}/pdf`;
  if (status !== "issued") {
    return (
      <div className="rounded-tf-lg border border-red-200 bg-red-50 p-4">
        <p className="font-semibold text-tf-danger">Invoice recorded (generation failed)</p>
        <p className="mt-1 text-sm">Number: <span className="font-mono">{invoiceNumber}</span></p>
      </div>
    );
  }
  return (
    <div className="rounded-tf-lg border border-tf-green/30 bg-tf-green-pale p-4">
      <p className="font-semibold text-tf-green-dark">Invoice ready 🎉</p>
      <p className="mt-1 text-sm">Number: <span className="font-mono">{invoiceNumber}</span></p>

      {/* Inline PDF preview — the whole thumbnail opens the full PDF in a new tab. */}
      <div className="relative mt-3 overflow-hidden rounded-tf border border-tf-divider bg-white shadow-sm">
        <div className="pointer-events-none">
          <PdfPreview url={pdfUrl} heightClass="h-64" />
        </div>
        <a
          href={pdfUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open invoice ${invoiceNumber} PDF in a new tab`}
          className="absolute inset-0 flex items-end justify-end p-2"
        >
          <span className="rounded-full bg-tf-green-strong px-3 py-1 text-xs font-semibold text-white shadow">Open PDF ↗</span>
        </a>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded-full bg-tf-green-strong px-4 py-2 text-sm font-semibold text-white">
          Open / download
        </a>
        <Link href="/invoices" className="rounded-full border border-tf-divider px-4 py-2 text-sm font-semibold">History</Link>
      </div>
    </div>
  );
}

export function BlockedCard({ decision, citations, reviewCaseId }: { decision: DecisionResult; citations: Citation[]; reviewCaseId: string | null }) {
  return (
    <div className="flex flex-col gap-3">
      <DecisionCard decision={decision} citations={citations} />
      <div className="rounded-tf-lg border border-tf-green/30 bg-tf-green-pale p-4 text-sm">
        <p className="font-semibold text-tf-green-dark">Good news — a tax expert can take it from here 🤝</p>
        <p className="mt-1 text-tf-ink">
          This case is outside what I can safely automate, so I didn&rsquo;t create an invoice, number, or PDF.
          A Taxfix tax expert can review it and get you sorted.
        </p>
        {reviewCaseId ? (
          <Link
            href="/review"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-tf-green-strong px-5 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-95"
          >
            Escalate to a tax expert →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ByokCard({
  byok,
  onChange,
  onRetry,
  message,
  busy,
}: {
  byok: { provider: ProviderName; model: string; apiKey: string };
  onChange: (b: { provider: ProviderName; model: string; apiKey: string }) => void;
  onRetry: () => void;
  message: string;
  busy?: boolean;
}) {
  return (
    <div className={cardCls}>
      <h3 className="text-sm font-bold">Use your own API key</h3>
      <p className="mt-1 text-xs text-tf-amber">{message}</p>
      <p className="mt-1 text-xs text-tf-gray">Held in memory for this request only — never stored, logged, or kept after a refresh.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select className={input} value={byok.provider} onChange={(e) => { const provider = e.target.value as ProviderName; onChange({ ...byok, provider, model: MODEL_ALLOWLIST[provider][0]!.id }); }}>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
        </select>
        <select className={input} value={byok.model} onChange={(e) => onChange({ ...byok, model: e.target.value })}>
          {MODEL_ALLOWLIST[byok.provider].map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <input type="password" autoComplete="off" className={`${input} col-span-2`} placeholder="API key (kept in memory only)" value={byok.apiKey} onChange={(e) => onChange({ ...byok, apiKey: e.target.value })} />
      </div>
      <button onClick={onRetry} disabled={busy || !byok.apiKey} className="mt-3 rounded-full bg-tf-green-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Retrying…" : "Retry with my key"}
      </button>
    </div>
  );
}
