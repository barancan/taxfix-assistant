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
