/**
 * Normalized, provider-agnostic error taxonomy. Providers differ in HTTP codes
 * and bodies, so each adapter maps its errors into this shape. Raw provider
 * bodies, keys and headers are NEVER surfaced to the client or logs.
 */
export type ProviderErrorKind =
  | "invalid_credentials"
  | "insufficient_credits"
  | "rate_limited"
  | "provider_unavailable"
  | "unsupported_model"
  | "invalid_output"
  | "timeout"
  | "file_rejected"
  | "unknown";

export interface NormalizedProviderError {
  ok: false;
  kind: ProviderErrorKind;
  retriable: boolean;
  /** Safe, user-facing message. Contains no secrets or raw provider text. */
  userMessage: string;
  /** True when the user could recover by supplying their own key (BYOK). */
  byokRecoverable: boolean;
}

const MESSAGES: Record<ProviderErrorKind, string> = {
  invalid_credentials: "The AI provider rejected the credentials.",
  insufficient_credits: "The AI provider account is out of credit or quota.",
  rate_limited: "The AI provider is rate limiting requests. Please retry shortly.",
  provider_unavailable: "The AI provider is temporarily unavailable.",
  unsupported_model: "The selected model is not available or does not support this input.",
  invalid_output: "The AI returned output that failed validation.",
  timeout: "The AI request timed out.",
  file_rejected: "The uploaded file could not be processed.",
  unknown: "The AI request could not be completed.",
};

export function makeError(kind: ProviderErrorKind): NormalizedProviderError {
  return {
    ok: false,
    kind,
    retriable: kind === "rate_limited" || kind === "provider_unavailable" || kind === "timeout",
    userMessage: MESSAGES[kind],
    byokRecoverable: kind === "invalid_credentials" || kind === "insufficient_credits" || kind === "rate_limited",
  };
}

interface MaybeApiError {
  status?: number;
  name?: string;
  code?: string;
  error?: { type?: string; code?: string };
}

export function normalizeAnthropicError(err: unknown): NormalizedProviderError {
  const e = err as MaybeApiError;
  if (e?.name === "AbortError") return makeError("timeout");
  const type = e?.error?.type;
  switch (e?.status) {
    case 401:
      return makeError("invalid_credentials");
    case 403:
      return makeError(type === "billing_error" ? "insufficient_credits" : "invalid_credentials");
    case 400:
      if (type === "invalid_request_error") return makeError("unsupported_model");
      return makeError("unknown");
    case 404:
      return makeError("unsupported_model");
    case 429:
      return makeError("rate_limited");
    case 500:
    case 503:
    case 529:
      return makeError("provider_unavailable");
    default:
      return makeError("unknown");
  }
}

export function normalizeOpenAiError(err: unknown): NormalizedProviderError {
  const e = err as MaybeApiError;
  if (e?.name === "AbortError") return makeError("timeout");
  const code = e?.error?.code ?? e?.code;
  if (code === "insufficient_quota") return makeError("insufficient_credits");
  if (code === "model_not_found") return makeError("unsupported_model");
  switch (e?.status) {
    case 401:
      return makeError("invalid_credentials");
    case 403:
      return makeError("invalid_credentials");
    case 404:
      return makeError("unsupported_model");
    case 429:
      return makeError("rate_limited");
    case 400:
      return makeError("unsupported_model");
    case 500:
    case 503:
      return makeError("provider_unavailable");
    default:
      return makeError("unknown");
  }
}
