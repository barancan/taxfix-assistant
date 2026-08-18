"use client";

import { useEffect, useRef, useState } from "react";
import { newId, type Msg } from "@/lib/conversation";
import { SKILLS, getSkill } from "@/skills/registry";
import type { AskOutcome, ByokCredentials, ChatHost, SkillExample } from "@/skills/types";
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

const GENERIC_AI_ERROR = "I couldn't reach the AI just now. Please try again.";

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
  async function askAssistant(question: string): Promise<AskOutcome> {
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
      if (data?.ok !== true) {
        // Surface the real reason. The provider error carries a safe message and
        // says whether the user's own key would fix it — never report a provider
        // failure as if the assistant misunderstood the question.
        if (data?.byokRecoverable) {
          return {
            kind: "needs_key",
            message: data.noServerKey
              ? "No AI key is configured on the server. Add your own to keep chatting."
              : data.userMessage,
          };
        }
        return { kind: "unavailable", message: data?.userMessage ?? GENERIC_AI_ERROR };
      }
      if (data.kind === "invoice_request") return { kind: "invoice_request" };
      if (data.escalated) {
        showHostCard("escalated", { reviewCaseId: data.reviewCaseId });
      } else if (data.kind === "question") {
        showHostCard("answer", { text: data.text, citations: data.citations });
      } else {
        say(data.text || "Happy to help!");
      }
      return { kind: "answered" };
    } catch {
      return { kind: "unavailable", message: GENERIC_AI_ERROR };
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

  /**
   * Start the skill flow. With `seed` (an invoice request typed in free chat)
   * the prior transcript is archived rather than dropped and the sentence is
   * handed to the skill, so the user never retypes details they just gave.
   * Without one this is the plain "New invoice" reset.
   */
  function startInvoice(seed?: string) {
    if (seed) {
      setArchived((a) => [...a, ...messages]);
      setMessages([{ id: newId(), role: "user", kind: "text", text: seed }]);
    } else {
      setArchived([]);
      setMessages([{ id: newId(), role: "assistant", kind: "text", text: activeSkill.intro }]);
    }
    setMode("skill");
    setFlowDone(false);
    setContext("");
    setByokOpen(false);
    setInput("");
    if (seed) skill.start(seed);
    else skill.reset();
  }

  async function sendChat(text: string) {
    youSaid(text);
    setChatBusy(true);
    try {
      const outcome = await askAssistant(text);
      if (outcome.kind === "invoice_request") {
        startInvoice(text);
      } else if (outcome.kind === "needs_key") {
        // The BYOK card carries its own message; adding a bubble would duplicate it.
        setByokMessage(outcome.message);
        byokRetry.current = () => sendChat(text);
        setByokOpen(true);
      } else if (outcome.kind === "unavailable") {
        say(outcome.message);
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

      {/* Sticky bar only for persistent affordances — the text input and the
          skill's own action. When a confirm card is active it carries its own
          button, so no redundant sticky hint; terminal actions render inline. */}
      {(() => {
        const footerAction =
          (mode === "skill" && skill.footer) || (Boolean(inputSpec) && !byokOpen);
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
                ) : (
                  <ChatInput
                    value={input}
                    onChange={setInput}
                    onSend={onSend}
                    onAttach={skill.onAttach}
                    placeholder={inputSpec!.placeholder}
                    disabled={busy}
                    showAttach={inputSpec!.showAttach}
                  />
                )}
              </div>
            ) : null}
          </div>
        );
      })()}
    </div>
  );
}
