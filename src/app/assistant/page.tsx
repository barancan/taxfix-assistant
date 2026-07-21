"use client";

import { useEffect, useRef, useState } from "react";
import type { Preset } from "@/lib/presets";
import { emptyCollected, buildClientFacts, buildInvoicePayload, type Collected } from "@/lib/facts";
import { SCRIPT, newId, type Msg, type Step } from "@/lib/conversation";
import type { ExtractionResult } from "@/ai/schema";
import type { ProviderName } from "@/ai/provider";
import { minorToMajor } from "@/lib/format";
import { Bubble, ChatInput, CollectedHeader, RecommendedPrompts, TypingBubble } from "@/components/chat/primitives";
import { DecisionCard } from "@/components/DecisionCard";
import {
  BlockedCard,
  ByokCard,
  CompanyConfirmCard,
  InvoiceReadyCard,
  LegalConfirmCard,
  LineItemsCard,
} from "@/components/chat/Cards";

interface PendingExtract {
  kind: "company" | "lineitems";
  text: string;
  file: File | null;
}

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

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>(() => [
    { id: newId(), role: "assistant", kind: "text", text: SCRIPT.intent },
  ]);
  // Collapsed earlier engagement, kept for context after "Continue conversation".
  const [archived, setArchived] = useState<Msg[]>([]);
  const [lastContext, setLastContext] = useState("");
  const [step, setStep] = useState<Step>("intent");
  const [c, setC] = useState<Collected>(emptyCollected());
  // Header reflects only CONFIRMED data — prefilled drafts stay hidden until the
  // user taps a confirm button.
  const [confirmed, setConfirmed] = useState<Collected>(emptyCollected());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [canGenerate, setCanGenerate] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  const [aiError, setAiError] = useState("");
  const [byok, setByok] = useState<{ provider: ProviderName; model: string; apiKey: string }>({ provider: "anthropic", model: "claude-sonnet-5", apiKey: "" });
  const pending = useRef<PendingExtract | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, step, byokOpen]);

  const patch = (p: Partial<Collected>) => setC((x) => ({ ...x, ...p }));
  const say = (text: string) => setMessages((m) => [...m, { id: newId(), role: "assistant", kind: "text", text }]);
  const youSaid = (text: string) => setMessages((m) => [...m, { id: newId(), role: "user", kind: "text", text }]);
  const showCard = (card: NonNullable<Msg["card"]>) => setMessages((m) => [...m, { id: newId(), role: "assistant", kind: "card", card }]);

  function pickPreset(p: Preset) {
    youSaid(p.sentence);
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
    say(`Great — here are the details I have for ${p.facts.customer.name}. Please confirm.`);
    setStep("company_confirm");
  }

  function submitIntent(text: string) {
    youSaid(text);
    patch({ intent: text });
    say(SCRIPT.company_ask!);
    setStep("company_ask");
  }

  async function callExtract(text: string, file: File | null): Promise<Response> {
    const withByok = byok.apiKey ? { provider: byok.provider, model: byok.model, apiKey: byok.apiKey } : undefined;
    if (file) {
      const fd = new FormData();
      fd.append("text", text);
      fd.append("files", file);
      if (withByok) fd.append("byok", JSON.stringify(withByok));
      return fetch("/api/extract", { method: "POST", body: fd });
    }
    return fetch("/api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, ...(withByok ? { byok: withByok } : {}) }) });
  }

  async function runExtraction(kind: "company" | "lineitems", text: string, file: File | null) {
    pending.current = { kind, text, file };
    setBusy(true);
    setTyping(true);
    setAiError("");
    try {
      const res = await callExtract(text, file);
      const data = await res.json();
      if (data?.ok === true) {
        setByokOpen(false);
        const x = data.data as ExtractionResult;
        if (kind === "company") {
          patch(applyExtraction(x));
          say("Here's what I found — please confirm.");
          setStep("company_confirm");
        } else {
          const lines = extractionLines(x);
          patch({ lines });
          say("Here are the line items I read — check the amounts.");
          setStep("lineitems_confirm");
        }
      } else if (data?.ok === false && data.byokRecoverable) {
        setAiError(data.noServerKey ? "No AI key is configured on the server. Add your own to use AI extraction." : data.userMessage);
        setByokOpen(true);
      } else {
        // Non-recoverable / empty → fall back to manual entry.
        if (kind === "company") {
          say("I couldn't read that clearly — please enter the details.");
          setStep("company_confirm");
        } else {
          say("Please enter the line items.");
          setStep("lineitems_confirm");
        }
      }
    } catch {
      say("Something went wrong reading that. Please enter the details manually.");
      setStep(kind === "company" ? "company_confirm" : "lineitems_confirm");
    } finally {
      setBusy(false);
      setTyping(false);
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
    say("Thanks. A couple of things I must confirm about this customer.");
    setStep("legal");
  }

  function confirmLegal() {
    setConfirmed((p) => ({ ...p, customerType: c.customerType, businessConfirmed: c.businessConfirmed, demoVies: c.demoVies, vatId: c.vatId }));
    if (c.lines.length > 0) {
      say("Here are the line items I have — edit or confirm.");
      setStep("lineitems_confirm");
    } else {
      say(SCRIPT.lineitems_ask!);
      setStep("lineitems_ask");
    }
  }

  async function confirmLineItems() {
    setConfirmed((p) => ({ ...p, lines: c.lines, currency: c.currency }));
    setStep("assessing");
    setTyping(true);
    say("Let me check the VAT treatment and prepare everything…");
    try {
      const res = await fetch("/api/decision", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ facts: buildClientFacts(c) }),
      });
      const data = await res.json();
      const decision = data.decision;
      setLastContext(
        `Customer ${c.customerName} in ${c.countryCode}; ${c.serviceCategory} service; currency ${c.currency}. Decision: ${decision.decisionCode} (${decision.status}).`,
      );
      if (decision.status === "approved") {
        showCard({ t: "decision", decision, citations: data.citations });
        say("Good news — this is supported. Want me to generate the invoice?");
        setCanGenerate(true);
        setStep("decided");
      } else if (decision.status === "needs_clarification") {
        showCard({ t: "decision", decision, citations: data.citations });
        say("I need a bit more detail before I can decide.");
        setStep("legal");
      } else {
        showCard({ t: "blocked", decision, citations: data.citations, reviewCaseId: data.reviewCaseId });
        setStep("decided");
      }
    } catch {
      say("I couldn't complete the assessment. Please try again.");
      setStep("lineitems_confirm");
    } finally {
      setTyping(false);
    }
  }

  async function generateInvoice() {
    setBusy(true);
    setCanGenerate(false);
    setTyping(true);
    try {
      const res = await fetch("/api/invoice", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildInvoicePayload(c)),
      });
      const data = await res.json();
      if (res.status === 409) {
        say("I can no longer issue this invoice — it needs expert review.");
        return;
      }
      showCard({ t: "invoiceReady", id: data.invoice.id, invoiceNumber: data.invoice.invoiceNumber, status: data.invoice.status });
      say("All done! Your invoice is ready above.");
      setLastContext((prev) => `${prev} Invoice ${data.invoice.invoiceNumber} was issued.`);
    } catch {
      say("Generation failed. Please try again.");
      setCanGenerate(true);
    } finally {
      setBusy(false);
      setTyping(false);
    }
  }

  function continueConversation() {
    setArchived((a) => [...a, ...messages]);
    setMessages([{ id: newId(), role: "assistant", kind: "text", text: "Sure — what else can I help you with? I still have the details from our conversation." }]);
    setCanGenerate(false);
    setStep("chat");
  }

  function startOver() {
    setArchived([]);
    setMessages([{ id: newId(), role: "assistant", kind: "text", text: SCRIPT.intent }]);
    setC(emptyCollected());
    setConfirmed(emptyCollected());
    setLastContext("");
    setCanGenerate(false);
    setByokOpen(false);
    setInput("");
    setStep("intent");
  }

  async function sendChat(text: string) {
    youSaid(text);
    setBusy(true);
    setTyping(true);
    const priorTurns = [...archived, ...messages]
      .filter((m) => m.kind === "text" && m.text)
      .map((m) => ({ role: m.role, content: m.text as string }))
      .slice(-12);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: [...priorTurns, { role: "user", content: text }],
          ...(lastContext ? { context: lastContext } : {}),
          ...(byok.apiKey ? { byok } : {}),
        }),
      });
      const data = await res.json();
      if (data?.ok === true) say(data.text);
      else if (data?.ok === false && data.noServerKey)
        say("I can chat more freely once an AI key is connected (Anthropic or OpenAI). In the meantime I can still help you create an invoice — tap “New invoice”, or describe the next one.");
      else if (data?.ok === false) say(data.userMessage ?? "Sorry, I couldn't respond just now.");
      else say("Sorry, I couldn't respond just now.");
    } catch {
      say("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
      setTyping(false);
    }
  }

  function onSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (step === "intent") submitIntent(text);
    else if (step === "company_ask") { youSaid(text); runExtraction("company", text, null); }
    else if (step === "lineitems_ask") { youSaid(text); runExtraction("lineitems", text, null); }
    else if (step === "chat") sendChat(text);
  }

  function onAttach(file: File) {
    youSaid("📷 Scanned a document");
    runExtraction(step === "lineitems_ask" ? "lineitems" : "company", "", file);
  }

  function retryByok() {
    const p = pending.current;
    if (p) runExtraction(p.kind, p.text, p.file);
  }

  function renderMessage(m: Msg) {
    if (m.kind === "text") return <Bubble key={m.id} role={m.role}>{m.text}</Bubble>;
    if (m.card?.t === "decision") return <DecisionCard key={m.id} decision={m.card.decision} citations={m.card.citations} />;
    if (m.card?.t === "blocked") return <BlockedCard key={m.id} decision={m.card.decision} citations={m.card.citations} reviewCaseId={m.card.reviewCaseId} />;
    if (m.card?.t === "invoiceReady") return <InvoiceReadyCard key={m.id} id={m.card.id} invoiceNumber={m.card.invoiceNumber} status={m.card.status} />;
    return null;
  }

  const isTerminal = step === "decided" && !canGenerate;
  const showInput = !byokOpen && (step === "intent" || step === "company_ask" || step === "lineitems_ask" || step === "chat");
  const placeholder =
    step === "intent" ? "Describe the invoice you need…" :
    step === "company_ask" ? "Company name, country, VAT ID…" :
    step === "lineitems_ask" ? "e.g. 40 hours at €95 for web development" :
    step === "chat" ? "Ask me anything…" : "";

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      <CollectedHeader
        collected={confirmed}
        onEdit={(section) => setStep(section === "company" ? "company_confirm" : section === "legal" ? "legal" : "lineitems_confirm")}
      />

      <div className="flex flex-1 flex-col gap-3 py-4">
        {archived.length > 0 ? (
          <details className="rounded-tf border border-tf-divider bg-tf-surface-muted px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-tf-gray">
              Earlier in this conversation ({archived.filter((m) => m.kind === "text").length} messages) — tap to expand
            </summary>
            <div className="mt-2 flex flex-col gap-2 opacity-75">{archived.map(renderMessage)}</div>
          </details>
        ) : null}

        {messages.map(renderMessage)}

        {typing ? <TypingBubble /> : null}

        {step === "company_confirm" ? <CompanyConfirmCard value={c} onPatch={patch} onConfirm={confirmCompany} /> : null}
        {step === "legal" ? <LegalConfirmCard value={c} onPatch={patch} onConfirm={confirmLegal} /> : null}
        {step === "lineitems_confirm" ? <LineItemsCard value={c} onPatch={patch} onConfirm={confirmLineItems} /> : null}

        {byokOpen ? (
          <ByokCard byok={byok} onChange={setByok} onRetry={retryByok} message={aiError} busy={busy} />
        ) : null}

        <div ref={endRef} />
      </div>

      <div className="sticky bottom-[76px] z-10 -mx-5 bg-tf-surface">
        {step === "intent" && !byokOpen ? (
          <div className="px-5 pb-2 pt-1">
            <RecommendedPrompts onPick={pickPreset} />
          </div>
        ) : null}
        <div className="border-t border-tf-divider px-5 py-2.5">
          {canGenerate ? (
            <button onClick={generateInvoice} disabled={busy} className="w-full rounded-full bg-tf-green-strong px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busy ? "Generating…" : "Generate invoice"}
            </button>
          ) : isTerminal ? (
            <div className="flex flex-col gap-2">
              <button onClick={continueConversation} className="w-full rounded-full bg-tf-green-strong px-5 py-3 text-sm font-semibold text-white active:scale-[0.99]">
                Continue to chat
              </button>
              <button onClick={startOver} className="w-full rounded-full border border-tf-divider px-5 py-2.5 text-sm font-semibold text-tf-ink">
                Start a new invoice
              </button>
            </div>
          ) : showInput ? (
            <>
              <ChatInput value={input} onChange={setInput} onSend={onSend} onAttach={onAttach} placeholder={placeholder} disabled={busy} showAttach={step === "company_ask"} />
              {step === "chat" ? (
                <button onClick={startOver} className="mt-2 text-xs font-semibold text-tf-green-dark">＋ New invoice</button>
              ) : null}
            </>
          ) : (
            <p className="text-center text-xs text-tf-gray">Use the card above to continue.</p>
          )}
        </div>
      </div>
    </div>
  );
}
