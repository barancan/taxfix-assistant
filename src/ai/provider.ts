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

export interface AiProvider {
  readonly name: ProviderName;
  readonly model: string;
  extract(input: AiExtractInput): Promise<ExtractOutcome>;
}

export const REQUEST_TIMEOUT_MS = 30_000;
