import type { ExtractionResult } from "./schema";
import type { NormalizedProviderError } from "./errors";

export type ProviderName = "anthropic" | "openai";

export interface AiFile {
  kind: "image" | "pdf";
  mediaType: string;
  dataBase64: string;
}

export interface AiExtractInput {
  text: string;
  profileSummary: string;
  files?: AiFile[];
}

export type ExtractOutcome =
  | { ok: true; data: ExtractionResult; provider: ProviderName; model: string }
  | NormalizedProviderError;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export type ChatOutcome =
  | { ok: true; text: string; provider: ProviderName; model: string }
  | NormalizedProviderError;

export interface AiProvider {
  readonly name: ProviderName;
  readonly model: string;
  extract(input: AiExtractInput): Promise<ExtractOutcome>;
  /** General, scoped assistant chat. Must never make a tax determination. */
  chat(system: string, turns: ChatTurn[]): Promise<ChatOutcome>;
}

export const REQUEST_TIMEOUT_MS = 30_000;
