"use client";

import { useMemo, useState } from "react";
import type { DecisionResult } from "@/domain/schemas";
import type { ExtractionResult } from "@/ai/schema";
import { minorToMajor } from "@/lib/format";
import type { ChatHost, SkillBindings, SkillExample } from "../types";
import { CollectedHeader, type HeaderChip } from "@/components/chat/primitives";
import {
  buildClientFacts,
  buildInvoicePayload,
  collectedSubtotal,
  emptyCollected,
  type Collected,
} from "./facts";
import { PRESETS } from "./examples";
import { CompanyConfirmCard, LegalConfirmCard, LineItemsCard } from "./Cards";

export type InvoiceStep =
  | "intent"
  | "company_ask"
  | "company_confirm"
  | "legal"
  | "lineitems_ask"
  | "lineitems_confirm"
  | "assessing"
  | "decided";

const SCRIPT: Partial<Record<InvoiceStep, string>> = {
  intent: "Hi! Tell me about the invoice you need — who are you billing and for what?",
  company_ask:
    "Who are you invoicing? Type the client's company details (name, country, VAT ID), or tap 📷 to scan a business card, contract, or invoice.",
  lineitems_ask: "What are you billing for? For example: “40 hours of web development at €95”.",
};

function applyExtraction(x: ExtractionResult): Partial<Collected> {
  const p: Partial<Collected> = {};
  if (x.customerName) p.customerName = x.customerName;
  if (x.customerCountryCode) p.countryCode = x.customerCountryCode.toUpperCase();
  if (x.customerVatId) p.vatId = x.customerVatId;
  if (x.suggestedCategory) p.serviceCategory = x.suggestedCategory;
  if (x.serviceDescription) p.serviceDescription = x.serviceDescription;
  if (x.currency) p.currency = x.currency.toUpperCase();
  if (x.customerAddressLines?.length) p.addressLines = x.customerAddressLines;
  return p;
}

function extractionLines(x: ExtractionResult): Collected["lines"] {
  if (x.lineItems?.length) {
    return x.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity ?? "1",
      unit: "unit",
      unitPriceMajor: li.unitPriceMajor ?? "0.00",
    }));
  }
  if (x.amountMajor) {
    return [{ description: x.serviceDescription ?? "Service", quantity: "1", unit: "project", unitPriceMajor: x.amountMajor }];
  }
  return [];
}

export function useInvoiceSkill(host: ChatHost): SkillBindings {
  const [step, setStep] = useState<InvoiceStep>("intent");
  const [c, setC] = useState<Collected>(emptyCollected());
  // Header shows only user-CONFIRMED data, never prefilled drafts.
  const [confirmed, setConfirmed] = useState<Collected>(emptyCollected());
  const [busy, setBusy] = useState(false);
  const [canGenerate, setCanGenerate] = useState(false);

  const patch = (p: Partial<Collected>) => setC((x) => ({ ...x, ...p }));

  async function callExtract(text: string, file: File | null): Promise<Response> {
    const creds = host.byok.credentials;
    const headers: Record<string, string> = { "x-skill": "invoice" };
    if (file) {
      const fd = new FormData();
      fd.append("text", text);
      fd.append("files", file);
      if (creds) fd.append("byok", JSON.stringify(creds));
      return fetch("/api/extract", { method: "POST", headers, body: fd });
    }
    return fetch("/api/extract", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ text, ...(creds ? { byok: creds } : {}) }),
    });
  }

  async function runExtraction(kind: "company" | "lineitems", text: string, file: File | null) {
    setBusy(true);
    host.setTyping(true);
    try {
      // Carry the original request into the company extraction so details the
      // user already stated up front (e.g. "…a client in Switzerland") aren't
      // lost — the company-details turn alone often omits the country.
      const apiText =
        kind === "company" && c.intent && c.intent.trim() !== text.trim()
          ? `${c.intent}\n${text}`.trim()
          : text;
      const res = await callExtract(apiText, file);
      const data = await res.json();
      if (data?.ok === true) {
        const x = data.data as ExtractionResult;
        if (kind === "company") {
          patch(applyExtraction(x));
          host.say("Here's what I found — please confirm.");
          setStep("company_confirm");
        } else {
          patch({ lines: extractionLines(x) });
          host.say("Here are the line items I read — check the amounts.");
          setStep("lineitems_confirm");
        }
      } else if (data?.ok === false && data.byokRecoverable) {
        const message = data.noServerKey
          ? "No AI key is configured on the server. Add your own to use AI extraction."
          : data.userMessage;
        host.byok.open(message, () => runExtraction(kind, text, file));
      } else {
        host.say(
          kind === "company"
            ? "I couldn't read that clearly — please enter the details."
            : "Please enter the line items.",
        );
        setStep(kind === "company" ? "company_confirm" : "lineitems_confirm");
      }
    } catch {
      host.say("Something went wrong reading that. Please enter the details manually.");
      setStep(kind === "company" ? "company_confirm" : "lineitems_confirm");
    } finally {
      setBusy(false);
      host.setTyping(false);
    }
  }

  function confirmCompany() {
    setConfirmed((p) => ({
      ...p,
      customerName: c.customerName,
      countryCode: c.countryCode,
      vatId: c.vatId,
      currency: c.currency,
      serviceCategory: c.serviceCategory,
      addressLines: c.addressLines,
    }));
    host.say("Thanks. A couple of things I must confirm about this customer.");
    setStep("legal");
  }

  function confirmLegal() {
    setConfirmed((p) => ({ ...p, customerType: c.customerType, businessConfirmed: c.businessConfirmed, demoVies: c.demoVies, vatId: c.vatId }));
    if (c.lines.length > 0) {
      host.say("Here are the line items I have — edit or confirm.");
      setStep("lineitems_confirm");
    } else {
      host.say(SCRIPT.lineitems_ask!);
      setStep("lineitems_ask");
    }
  }

  async function confirmLineItems() {
    setConfirmed((p) => ({ ...p, lines: c.lines, currency: c.currency }));
    setStep("assessing");
    host.setTyping(true);
    host.say("Let me check the VAT treatment and prepare everything…");
    try {
      const res = await fetch("/api/decision", {
        method: "POST",
        headers: { "content-type": "application/json", "x-skill": "invoice" },
        body: JSON.stringify({ facts: buildClientFacts(c) }),
      });
      const data = await res.json();
      const decision: DecisionResult = data.decision;
      const context = `Customer ${c.customerName} in ${c.countryCode}; ${c.serviceCategory} service; currency ${c.currency}. Decision: ${decision.decisionCode} (${decision.status}).`;
      if (decision.status === "approved") {
        host.showCard("decision", { decision, citations: data.citations });
        host.say("Good news — this is supported. Want me to generate the invoice?");
        setCanGenerate(true);
        setStep("decided");
        host.finishFlow(context); // terminal once generation completes or is skipped
      } else if (decision.status === "needs_clarification") {
        host.showCard("decision", { decision, citations: data.citations });
        host.say("I need a bit more detail before I can decide.");
        setStep("legal");
      } else {
        host.showCard("blocked", { decision, citations: data.citations, reviewCaseId: data.reviewCaseId });
        setStep("decided");
        host.finishFlow(context);
      }
    } catch {
      host.say("I couldn't complete the assessment. Please try again.");
      setStep("lineitems_confirm");
    } finally {
      host.setTyping(false);
    }
  }

  async function generateInvoice() {
    setBusy(true);
    setCanGenerate(false);
    host.setTyping(true);
    try {
      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { "content-type": "application/json", "x-skill": "invoice" },
        body: JSON.stringify(buildInvoicePayload(c)),
      });
      const data = await res.json();
      if (res.status === 409) {
        host.say("I can no longer issue this invoice — it needs expert review.");
        return;
      }
      host.showCard("invoiceReady", { id: data.invoice.id, invoiceNumber: data.invoice.invoiceNumber, status: data.invoice.status });
      host.say("All done! Your invoice is ready above.");
      host.finishFlow(`Invoice ${data.invoice.invoiceNumber} was issued for ${c.customerName}.`);
    } catch {
      host.say("Generation failed. Please try again.");
      setCanGenerate(true);
    } finally {
      setBusy(false);
      host.setTyping(false);
    }
  }

  function startExample(example: SkillExample) {
    const p = PRESETS.find((x) => x.id === example.id);
    if (!p) return;
    host.youSaid(p.sentence);
    setC({
      intent: p.sentence,
      customerName: p.facts.customer.name,
      countryCode: p.facts.customer.countryCode,
      customerType: p.facts.customer.type,
      businessConfirmed: p.facts.evidence.businessStatusConfirmedByUser,
      vatId: p.facts.customer.vatId ?? "",
      demoVies: p.facts.evidence.vatIdCheck === "demo_vies",
      serviceCategory: p.facts.service.category,
      serviceDescription: p.facts.service.normalizedDescription,
      currency: p.draft.currency,
      addressLines: p.customerAddressLines,
      lines: p.draft.lines.map((l) => ({ description: l.description, quantity: l.quantity, unit: l.unit, unitPriceMajor: minorToMajor(l.unitPriceMinor) })),
    });
    host.say(`Great — here are the details I have for ${p.facts.customer.name}. Please confirm.`);
    setStep("company_confirm");
  }

  /**
   * Extract every available field from the opening request so the user isn't
   * re-asked for details they already gave. Prefills company + line items and
   * jumps to the confirmation card when a customer was found.
   */
  async function extractFromIntent(text: string) {
    host.setTyping(true);
    try {
      const res = await callExtract(text, null);
      const data = await res.json();
      if (data?.ok === true) {
        const x = data.data as ExtractionResult;
        const lines = extractionLines(x);
        patch({ ...applyExtraction(x), ...(lines.length ? { lines } : {}) });
        const gotCompany = Boolean(x.customerName);
        host.say(gotCompany ? "Great — here's what I picked up. Please confirm the details." : "Got it. Who are you invoicing?");
        setStep(gotCompany ? "company_confirm" : "company_ask");
      } else if (data?.ok === false && data.byokRecoverable) {
        host.byok.open(
          data.noServerKey ? "No AI key is configured on the server. Add your own to use AI extraction." : data.userMessage,
          () => extractFromIntent(text),
        );
      } else {
        host.say(SCRIPT.company_ask!);
        setStep("company_ask");
      }
    } catch {
      host.say(SCRIPT.company_ask!);
      setStep("company_ask");
    } finally {
      host.setTyping(false);
    }
  }

  async function onInput(text: string) {
    if (step === "intent") {
      host.youSaid(text);
      patch({ intent: text });
      setBusy(true);
      try {
        // Route first: generic questions get a light, cited (or escalated)
        // answer and the flow stays here; real invoice intent proceeds.
        const outcome = await host.askAssistant(text);
        if (outcome === "answered") {
          host.say("Anything else? When you're ready, tell me about the invoice you need.");
          return;
        }
        if (outcome === "unavailable") {
          // No AI — fall back to the manual company step.
          host.say(SCRIPT.company_ask!);
          setStep("company_ask");
          return;
        }
        // Invoice intent → pull everything already provided, then confirm.
        await extractFromIntent(text);
      } finally {
        setBusy(false);
      }
    } else if (step === "company_ask" || step === "lineitems_ask") {
      host.youSaid(text);
      // Light mid-flow detour: a question mark routes to the answer endpoint,
      // then the pending step question is re-asked.
      if (text.trim().endsWith("?")) {
        setBusy(true);
        try {
          const outcome = await host.askAssistant(text);
          if (outcome === "answered") {
            host.say(step === "company_ask" ? SCRIPT.company_ask! : SCRIPT.lineitems_ask!);
            return;
          }
        } finally {
          setBusy(false);
        }
      }
      runExtraction(step === "company_ask" ? "company" : "lineitems", text, null);
    }
  }

  function onAttach(file: File) {
    host.youSaid("📷 Scanned a document");
    runExtraction(step === "lineitems_ask" ? "lineitems" : "company", "", file);
  }

  function reset() {
    setStep("intent");
    setC(emptyCollected());
    setConfirmed(emptyCollected());
    setBusy(false);
    setCanGenerate(false);
  }

  const chips = useMemo<HeaderChip[]>(() => {
    const out: HeaderChip[] = [];
    if (confirmed.customerName) {
      out.push({
        label: `👤 ${confirmed.customerName} · ${confirmed.countryCode}${confirmed.vatId ? " · " + confirmed.vatId : ""}`,
        onClick: () => setStep("company_confirm"),
      });
    }
    if (confirmed.customerType !== "unknown") {
      out.push({ label: `🏷 ${confirmed.customerType}`, onClick: () => setStep("legal") });
    }
    if (confirmed.lines.length > 0) {
      const total = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(collectedSubtotal(confirmed));
      out.push({ label: `🧾 ${confirmed.lines.length} item(s) · ${total} ${confirmed.currency}`, onClick: () => setStep("lineitems_confirm") });
    }
    return out;
  }, [confirmed]);

  const input =
    step === "intent" ? { placeholder: "Describe the invoice you need…", showAttach: false } :
    step === "company_ask" ? { placeholder: "Company name, country, VAT ID…", showAttach: true } :
    step === "lineitems_ask" ? { placeholder: "e.g. 40 hours at €95 for web development", showAttach: false } :
    null;

  return {
    header: <CollectedHeader chips={chips} />,
    activeCard:
      step === "company_confirm" ? <CompanyConfirmCard value={c} onPatch={patch} onConfirm={confirmCompany} /> :
      step === "legal" ? <LegalConfirmCard value={c} onPatch={patch} onConfirm={confirmLegal} /> :
      step === "lineitems_confirm" ? <LineItemsCard value={c} onPatch={patch} onConfirm={confirmLineItems} /> :
      null,
    footer: canGenerate ? (
      <button
        onClick={generateInvoice}
        disabled={busy}
        className="w-full rounded-full bg-tf-green-strong px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Generating…" : "Generate invoice"}
      </button>
    ) : null,
    input,
    busy,
    onInput,
    onAttach,
    startExample,
    reset,
  };
}
