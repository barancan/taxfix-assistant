import type { CardMsg } from "@/skills/types";

/**
 * Generic client-side conversation model shared by the chat host and all
 * skills. Skill-specific steps, scripts, and card payloads live inside each
 * skill module (see `src/skills/`).
 */
export interface Msg {
  id: string;
  role: "assistant" | "user";
  kind: "text" | "card";
  text?: string;
  /** Structured card rendered by the owning skill (see registry). */
  card?: CardMsg;
}

let counter = 0;
export function newId(): string {
  counter += 1;
  return `m${counter}_${Date.now().toString(36)}`;
}
