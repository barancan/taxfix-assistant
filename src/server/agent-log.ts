import "server-only";

/**
 * Human-readable agent trace for the terminal: which skill is acting, what
 * query goes to the model, and what came back. Demo/observability aid.
 *
 * Enabled by default in development; disabled in production unless
 * AGENT_TRACE=true. Never logs API keys, auth headers, or raw file bytes —
 * files are described as mime+size, and free text is truncated.
 */
function enabled(): boolean {
  if (process.env.AGENT_TRACE === "true") return true;
  if (process.env.AGENT_TRACE === "false") return false;
  return process.env.NODE_ENV !== "production";
}

function trunc(s: string, n = 180): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n)}…` : one;
}

function line(icon: "▶" | "◀" | "·", skill: string, action: string, detail: string): void {
  if (!enabled()) return;
  console.log(`[agent] ${icon} ${skill} · ${action} — ${detail}`);
}

/** An agent action is starting (skill call, engine evaluation, generation…). */
export function agentAction(skill: string, action: string, detail: string): void {
  line("▶", skill, action, detail);
}

/** A query is being sent to a model — logged in plain language. */
export function agentModelQuery(
  skill: string,
  action: string,
  provider: string,
  model: string,
  query: string,
  files?: { mediaType: string; bytes: number }[],
): void {
  const fileNote = files?.length
    ? ` (+${files.length} file${files.length > 1 ? "s" : ""}: ${files.map((f) => `${f.mediaType} ${(f.bytes / 1024).toFixed(0)}KB`).join(", ")})`
    : "";
  line("▶", skill, action, `asking ${provider}/${model}: "${trunc(query)}"${fileNote}`);
}

/** The model responded (or failed) — summarized in plain language. */
export function agentModelResponse(skill: string, action: string, ms: number, summary: string): void {
  line("◀", skill, action, `${(ms / 1000).toFixed(1)}s — ${trunc(summary, 240)}`);
}

/** A deterministic action finished — summarized in plain language. */
export function agentResult(skill: string, action: string, summary: string): void {
  line("◀", skill, action, trunc(summary, 240));
}

/** Skill attribution from the request (set by the client per call). */
export function skillOf(req: Request): string {
  return req.headers.get("x-skill") ?? "assistant";
}
