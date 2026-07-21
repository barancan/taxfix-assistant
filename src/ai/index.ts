import "server-only";
import { getEnv } from "@/config/env";
import { AnthropicProvider } from "./anthropic";
import { OpenAiProvider } from "./openai";
import { isModelAllowed } from "./models";
import type { AiProvider, ProviderName } from "./provider";

export type { AiProvider, ProviderName, AiExtractInput, ExtractOutcome } from "./provider";

export interface ByokRequest {
  provider: ProviderName;
  model: string;
  apiKey: string;
}

/** Server-funded provider from env. Returns null when no key is configured. */
export function resolveServerProvider(): AiProvider | null {
  const env = getEnv();
  const provider = env.AI_DEFAULT_PROVIDER;
  if (provider === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) return null;
    return new AnthropicProvider(env.ANTHROPIC_MODEL, env.ANTHROPIC_API_KEY);
  }
  if (!env.OPENAI_API_KEY) return null;
  return new OpenAiProvider(env.OPENAI_MODEL, env.OPENAI_API_KEY);
}

/**
 * BYOK provider. The key is used only to build this request-scoped provider and
 * is never persisted or logged. The model must be on the allowlist.
 */
export function createByokProvider(req: ByokRequest): AiProvider | null {
  if (!isModelAllowed(req.provider, req.model)) return null;
  if (req.provider === "anthropic") return new AnthropicProvider(req.model, req.apiKey);
  return new OpenAiProvider(req.model, req.apiKey);
}

export function byokEnabled(): boolean {
  return getEnv().AI_ALLOW_BYOK;
}
