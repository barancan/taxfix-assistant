import { describe, expect, it } from "vitest";
import { AnthropicProvider, type AnthropicLike } from "@/ai/anthropic";
import { OpenAiProvider, type OpenAiLike } from "@/ai/openai";
import { normalizeAnthropicError, normalizeOpenAiError } from "@/ai/errors";
import { isModelAllowed, modelSupportsFiles } from "@/ai/models";

const VALID = {
  customerName: "Exemplo Lda",
  customerCountryName: "Portugal",
  customerCountryCode: "PT",
  customerVatId: "PT123456789",
  customerAddressLines: ["Av. da Liberdade 100", "Lisboa"],
  serviceDescription: "Web development",
  suggestedCategory: "software_development",
  currency: "EUR",
  amountMajor: "3800",
  invoiceDate: null,
  lineItems: [{ description: "Dev", quantity: "40", unitPriceMajor: "95" }],
  missingHints: [],
};

describe("AI provider adapters (mocked clients)", () => {
  it("Anthropic: parses a forced tool_use result", async () => {
    const client: AnthropicLike = {
      messages: {
        create: async () => ({ content: [{ type: "tool_use", name: "record_extracted_invoice_fields", input: VALID }] }),
      },
    };
    const p = new AnthropicProvider("claude-sonnet-5", "sk-test", client);
    const out = await p.extract({ text: "invoice PT client", profileSummary: "x" });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.customerCountryCode).toBe("PT");
  });

  it("Anthropic: malformed tool output → invalid_output", async () => {
    const client: AnthropicLike = {
      messages: { create: async () => ({ content: [{ type: "tool_use", name: "record_extracted_invoice_fields", input: { customerName: 123 } }] }) },
    };
    const p = new AnthropicProvider("claude-sonnet-5", "sk-test", client);
    const out = await p.extract({ text: "x", profileSummary: "x" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.kind).toBe("invalid_output");
  });

  it("Anthropic: auth failure normalizes without leaking", async () => {
    const client: AnthropicLike = {
      messages: { create: async () => { throw { status: 401, error: { type: "authentication_error" } }; } },
    };
    const p = new AnthropicProvider("claude-sonnet-5", "sk-bad", client);
    const out = await p.extract({ text: "x", profileSummary: "x" });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.kind).toBe("invalid_credentials");
      expect(out.byokRecoverable).toBe(true);
      expect(out.userMessage).not.toContain("sk-bad");
    }
  });

  it("OpenAI: parses structured output_text", async () => {
    const client: OpenAiLike = {
      responses: { create: async () => ({ output_text: JSON.stringify(VALID) }) },
    };
    const p = new OpenAiProvider("gpt-5.4", "sk-test", client);
    const out = await p.extract({ text: "x", profileSummary: "x" });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.currency).toBe("EUR");
  });

  it("OpenAI: insufficient quota → insufficient_credits (BYOK recoverable)", async () => {
    const client: OpenAiLike = {
      responses: { create: async () => { throw { status: 429, error: { code: "insufficient_quota" } }; } },
    };
    const p = new OpenAiProvider("gpt-5.4", "sk-test", client);
    const out = await p.extract({ text: "x", profileSummary: "x" });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.kind).toBe("insufficient_credits");
  });

  it("normalizes provider errors distinctly", () => {
    expect(normalizeAnthropicError({ status: 429 }).kind).toBe("rate_limited");
    expect(normalizeAnthropicError({ status: 529 }).kind).toBe("provider_unavailable");
    expect(normalizeOpenAiError({ status: 404 }).kind).toBe("unsupported_model");
  });

  it("model allowlist gates BYOK selection", () => {
    expect(isModelAllowed("anthropic", "claude-sonnet-5")).toBe(true);
    expect(isModelAllowed("anthropic", "totally-made-up")).toBe(false);
    expect(modelSupportsFiles("openai", "gpt-5.4")).toBe(true);
  });
});
