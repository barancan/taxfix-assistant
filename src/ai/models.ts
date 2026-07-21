import type { ProviderName } from "./provider";

export interface ModelInfo {
  id: string;
  label: string;
  vision: boolean;
  pdf: boolean;
}

/**
 * Server-curated allowlist. BYOK users may only pick from these — arbitrary
 * model identifiers are never accepted. Only models with the required modality
 * may be used for image/PDF extraction.
 */
export const MODEL_ALLOWLIST: Record<ProviderName, ModelInfo[]> = {
  anthropic: [
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", vision: true, pdf: true },
    { id: "claude-opus-4-8", label: "Claude Opus 4.8", vision: true, pdf: true },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", vision: true, pdf: true },
  ],
  openai: [
    { id: "gpt-5.4", label: "GPT-5.4", vision: true, pdf: true },
    { id: "gpt-5.4-mini", label: "GPT-5.4 mini", vision: true, pdf: true },
  ],
};

export function isModelAllowed(provider: ProviderName, model: string): boolean {
  return MODEL_ALLOWLIST[provider]?.some((m) => m.id === model) ?? false;
}

export function modelSupportsFiles(provider: ProviderName, model: string): boolean {
  const info = MODEL_ALLOWLIST[provider]?.find((m) => m.id === model);
  return Boolean(info?.vision && info?.pdf);
}
