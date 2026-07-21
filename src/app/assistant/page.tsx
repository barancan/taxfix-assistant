"use client";

import { useEffect, useRef, useState } from "react";
import { newId, type Msg } from "@/lib/conversation";
import { SKILLS, getSkill } from "@/skills/registry";
import type { ByokCredentials, ChatHost, SkillExample } from "@/skills/types";
import { Bubble, ChatInput, RecommendedPrompts, TypingBubble } from "@/components/chat/primitives";
import { ByokCard } from "@/components/chat/ByokCard";
import { AnswerCard, EscalatedAnswerCard } from "@/components/chat/AnswerCard";
import type { Citation } from "@/domain/corpus";

/**
 * Generic assistant chat HOST. Owns the transcript, typing indicator, BYOK
 * recovery, free-chat fallback, and the continue-to-chat lifecycle. All product
 * capabilities are skills from `src/skills/registry.ts` — the host has no
 * invoice-specific (or other domain) logic.
 */
const activeSkill = SKILLS[0]!; // single active skill for now; intent routing later

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>(() => [
    { id: newId(), role: "assistant", kind: "text", text: activeSkill.intro },
  ]);
  const [archived, setArchived] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [mode, setMode] = useState<"skill" | "chat">("skill");
  const [flowDone, setFlowDone] = useState(false);
  const [context, setContext] = useState("");
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);

  // BYOK: memory-only credentials shared by skills and the free chat.
  const [byokOpen, setByokOpen] = useState(false);
  const [byokMessage, setByokMessage] = useState("");
  const [creds, setCreds] = useState<ByokCredentials>({ provider: "anthropic", model: "claude-sonnet-5", apiKey: "" });
  const byokRetry = useRef<(() => void) | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, byokOpen]);

  const say = (text: string) => setMessages((m) => [...m, { id: newId(), role: "assistant", kind: "text", text }]);
  const youSaid = (text: string) => setMessages((m) => [...m, { id: newId(), role: "user", kind: "text", text }]);
  const showHostCard = (type: string, props: unknown) =>
    setMessages((m) => [...m, { id: newId(), role: "assistant", kind: "card", card: { skillId: "assistant", type, props } }]);

  /**
   * Route a free-text turn through the structured answer endpoint (/api/chat):
   * classification + light cited answer + confidence gate (below the env
   * threshold the server escalates to a human review case).
   */
  async function askAssistant(question: string): Promise<"invoice_request" | "answered" | "unavailable"> {
    setTyping(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json", "x-skill": mode === "chat" ? "chat" : activeSkill.id },
        body: JSON.stringify({
          messages: [{ role: "user", content: question }],
          ...(context ? { context } : {}),
          ...(creds.apiKey ? { byok: creds } : {}),
        }),
      });
      const data = await res.json();
      if (data?.ok !== true) return "unavailable";
      if (data.kind === "invoice_request") return "invoice_request";
      if (data.escalated) {
        showHostCard("escalated", { reviewCaseId: data.reviewCaseId });
      } else if (data.kind === "question") {
        showHostCard("answer", { text: data.text, citations: data.citations });
      } else {
        say(data.text || "Happy to help!");
      }
      return "answered";
    } catch {
      return "unavailable";
    } finally {
      setTyping(false);
    }
  }

  const host: ChatHost = {
    say,
    youSaid,
    showCard: (type, props) =>
      setMessages((m) => [...m, { id: newId(), role: "assistant", kind: "card", card: { skillId: activeSkill.id, type, props } }]),
    setTyping,
    byok: {
      credentials: creds.apiKey ? creds : null,
      open: (message, retry) => {
        setByokMessage(message);
        byokRetry.current = retry;
        setByokOpen(true);
      },
    },
    finishFlow: (summary) => {
      setContext(summary);
      setFlowDone(true);
    },
    askAssistant,
  };

  const skill = activeSkill.useSkill(host);

  function continueToChat() {
    setArchived((a) => [...a, ...messages]);
    setMessages([{ id: newId(), role: "assistant", kind: "text", text: "Sure — what else can I help you with? I still have the details from our conversation." }]);
    setMode("chat");
  }

  function startOver() {
    setArchived([]);
    setMessages([{ id: newId(), role: "assistant", kind: "text", text: activeSkill.intro }]);
    setMode("skill");
    setFlowDone(false);
    setContext("");
    setByokOpen(false);
    setInput("");
    skill.reset();
  }

  async function sendChat(text: string) {
    youSaid(text);
    setChatBusy(true);
    try {
      const outcome = await askAssistant(text);
      if (outcome === "invoice_request") {
        say("Sounds like you want to create an invoice — tap “New invoice” below and I'll walk you through it.");
      } else if (outcome === "unavailable") {
        say("I can't answer general questions right now. Tap “New invoice” and I'll walk you through the next one.");
      }
    } finally {
      setChatBusy(false);
    }
  }

  function onSend() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (mode === "chat") sendChat(text);
    else skill.onInput(text);
  }

  function onExample(e: SkillExample) {
    skill.startExample(e);
  }

  function renderMessage(m: Msg) {
    if (m.kind === "text") return <Bubble key={m.id} role={m.role}>{m.text}</Bubble>;
    if (m.card) {
      // Host-level cards (general answers/escalations) are rendered here;
      // everything else is delegated to the owning skill.
      if (m.card.skillId === "assistant") {
        if (m.card.type === "answer") {
          const { text, citations } = m.card.props as { text: string; citations: Citation[] };
          return <AnswerCard key={m.id} text={text} citations={citations} />;
        }
        if (m.card.type === "escalated") {
          const { reviewCaseId } = m.card.props as { reviewCaseId: string | null };
          return <EscalatedAnswerCard key={m.id} reviewCaseId={reviewCaseId} />;
        }
        return null;
      }
      const owner = getSkill(m.card.skillId);
      return <div key={m.id}>{owner?.renderCard(m.card.type, m.card.props)}</div>;
    }
    return null;
  }

  const busy = skill.busy || chatBusy;
  const showExamples = mode === "skill" && !flowDone && !byokOpen && skill.input !== null && messages.length <= 1;
  const inputSpec = mode === "chat" ? { placeholder: "Ask me anything…", showAttach: false } : skill.input;
  const showTerminal = mode === "skill" && flowDone && !skill.footer;

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      {mode === "skill" ? skill.header : null}

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

        {mode === "skill" && !flowDone ? skill.activeCard : null}

        {byokOpen ? (
          <ByokCard
            byok={creds}
            onChange={setCreds}
            onRetry={() => {
              setByokOpen(false);
              byokRetry.current?.();
            }}
            message={byokMessage}
            busy={busy}
          />
        ) : null}

        <div ref={endRef} />
      </div>

      {/* Sticky bar only when there's a real action; when a confirm card is
          active it carries its own button, so no redundant sticky hint. */}
      {(() => {
        const footerAction =
          (mode === "skill" && skill.footer) || showTerminal || (Boolean(inputSpec) && !byokOpen);
        if (!showExamples && !footerAction) return null;
        return (
          <div className="sticky bottom-[76px] z-10 -mx-5 bg-tf-surface">
            {showExamples ? (
              <div className="px-5 pb-2 pt-1">
                <RecommendedPrompts examples={SKILLS.flatMap((s) => s.examples)} onPick={onExample} />
              </div>
            ) : null}
            {footerAction ? (
              <div className="border-t border-tf-divider px-5 py-2.5">
                {mode === "skill" && skill.footer ? (
                  skill.footer
                ) : showTerminal ? (
                  <div className="flex flex-col gap-2">
                    <button onClick={continueToChat} className="w-full rounded-full bg-tf-green-strong px-5 py-3 text-sm font-semibold text-white active:scale-[0.99]">
                      Continue to chat
                    </button>
                    <button onClick={startOver} className="w-full rounded-full border border-tf-divider px-5 py-2.5 text-sm font-semibold text-tf-ink">
                      Start a new invoice
                    </button>
                  </div>
                ) : (
                  <>
                    <ChatInput
                      value={input}
                      onChange={setInput}
                      onSend={onSend}
                      onAttach={skill.onAttach}
                      placeholder={inputSpec!.placeholder}
                      disabled={busy}
                      showAttach={inputSpec!.showAttach}
                    />
                    {mode === "chat" ? (
                      <button onClick={startOver} className="mt-2 text-xs font-semibold text-tf-green-dark">＋ New invoice</button>
                    ) : null}
                  </>
                )}
              </div>
            ) : null}
          </div>
        );
      })()}
    </div>
  );
}
