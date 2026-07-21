import type { ReactNode } from "react";
import type { ProviderName } from "@/ai/provider";

/**
 * Assistant skill contract.
 *
 * The assistant is a generic chat HOST; every capability (invoicing today,
 * incoming-invoice review tomorrow, …) is a SKILL registered in
 * `src/skills/registry.ts`. A skill owns its conversation steps, structured
 * cards, and API calls, while the host owns the transcript, typing indicator,
 * free-chat fallback, BYOK recovery, and the continue-to-chat lifecycle.
 *
 * Trust boundary is unchanged: skills call the deterministic server APIs; the
 * LLM only extracts and phrases.
 */

export type ExampleOutcome = "success" | "escalate" | "blocked";

export interface SkillExample {
  id: string;
  /** Short pill label shown above the chat input. */
  label: string;
  /** The user message sent when the example is tapped. */
  sentence: string;
  /** Expected engine outcome — drives the pill color. */
  outcome: ExampleOutcome;
}

/** A structured card stored in the transcript; rendered by its skill. */
export interface CardMsg {
  skillId: string;
  type: string;
  props: unknown;
}

export interface ByokCredentials {
  provider: ProviderName;
  model: string;
  apiKey: string;
}

/** Host-owned BYOK recovery. Skills request it; the host renders the card. */
export interface ByokControl {
  /** Current in-memory credentials (never persisted), or null. */
  credentials: ByokCredentials | null;
  /** Open the BYOK recovery card; `retry` re-runs the failed action. */
  open(message: string, retry: () => void): void;
}

/** What a skill may do to the shared conversation. */
export interface ChatHost {
  say(text: string): void;
  youSaid(text: string): void;
  /** Append a structured card to the transcript (skillId is stamped by the host). */
  showCard(type: string, props: unknown): void;
  setTyping(v: boolean): void;
  byok: ByokControl;
  /**
   * Mark the current skill flow as finished (invoice issued, case escalated…).
   * The host then offers "Continue to chat" / "Start over" and seeds the free
   * chat with `contextSummary`.
   */
  finishFlow(contextSummary: string): void;
}

export interface SkillInputSpec {
  placeholder: string;
  showAttach: boolean;
}

/** Live bindings returned by a skill's hook for the host to render. */
export interface SkillBindings {
  /** Sticky collected-information chips (or null before anything is confirmed). */
  header: ReactNode;
  /** The current interactive card (confirm forms etc.), rendered under the transcript. */
  activeCard: ReactNode;
  /** Skill-owned footer action (e.g. "Generate invoice"), replaces the input when set. */
  footer: ReactNode;
  /** Free-text input config for the current step; null = input hidden. */
  input: SkillInputSpec | null;
  busy: boolean;
  onInput(text: string): void;
  onAttach(file: File): void;
  startExample(example: SkillExample): void;
  reset(): void;
}

export interface SkillDefinition {
  id: string;
  title: string;
  /** First assistant message when the skill (re)starts. */
  intro: string;
  examples: SkillExample[];
  /** React hook driving the skill's flow. Called by the host page. */
  useSkill(host: ChatHost): SkillBindings;
  /** Render a transcript card previously added via host.showCard. */
  renderCard(type: string, props: unknown): ReactNode;
}
