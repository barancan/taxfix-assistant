import { invoiceSkill } from "./invoice";
import type { SkillDefinition } from "./types";

/**
 * Ordered skill registry. The chat host activates the first skill by default
 * and aggregates every skill's example prompts. Adding a capability to the
 * assistant = adding a folder under `src/skills/` and registering it here.
 */
export const SKILLS: SkillDefinition[] = [invoiceSkill];

export function getSkill(id: string): SkillDefinition | undefined {
  return SKILLS.find((s) => s.id === id);
}
