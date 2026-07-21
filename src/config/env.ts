import "server-only";
import { z } from "zod";

/**
 * Server-only environment access. Parsed once, lazily. Never import this from a
 * client component — secrets must never reach the browser bundle.
 */
const EnvSchema = z.object({
  DEMO_MODE: z
    .string()
    .optional()
    .transform((v) => v !== "false"), // default true

  AI_DEFAULT_PROVIDER: z.enum(["anthropic", "openai"]).default("anthropic"),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5.4"),
  AI_ALLOW_BYOK: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  AI_SERVER_FALLBACK: z
    .string()
    .optional()
    .transform((v) => v === "true"),

  /**
   * Display gate for general-question answers: below this self-assessed model
   * confidence the answer is suppressed and the subject is raised to a human
   * (review case). Only ever suppresses answers — never feeds tax decisions.
   */
  ANSWER_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.65),

  /**
   * Minimum lexical-retrieval relevance [0..1] for a general question to be
   * considered "grounded" in the knowledge base. Below it (or with no matching
   * entry) the question is raised to a human instead of answered. Calibrated
   * scale: a clearly relevant top match ≈ 0.7–1.0, a partial match ≈ 0.4–0.6,
   * off-topic ≈ 0. Sensible range 0.25–0.45.
   */
  KNOWLEDGE_RELEVANCE_MIN: z.coerce.number().min(0).max(1).default(0.3),

  SUPABASE_URL: z.string().url().optional().or(z.literal("").transform(() => undefined)),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("invoices"),

  SESSION_SECRET: z.string().min(16).default("dev-insecure-session-secret-change-me"),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  cached = EnvSchema.parse(process.env);
  return cached;
}

/** True when a usable Supabase server configuration is present. */
export function hasSupabase(env = getEnv()): boolean {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}
