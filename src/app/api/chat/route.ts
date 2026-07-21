import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/config/env";
import { getSessionId } from "@/server/session-server";
import { getStorage } from "@/server/storage";
import { byokEnabled, createByokProvider, resolveServerProvider } from "@/ai";
import { isModelAllowed } from "@/ai/models";
import { answerSystemPrompt, passesThreshold, sanitizeAnswer } from "@/ai/answer";
import { getCitations } from "@/domain/corpus";
import { makeError } from "@/ai/errors";
import type { ProviderName } from "@/ai/provider";
import { agentModelQuery, agentModelResponse, skillOf } from "@/server/agent-log";

export const runtime = "nodejs";

const BodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }))
    .min(1)
    .max(20),
  context: z.string().max(1000).optional(),
  byok: z
    .object({ provider: z.enum(["anthropic", "openai"]), model: z.string(), apiKey: z.string() })
    .optional(),
});

/**
 * Structured general-input endpoint: classifies the user's turn, may answer
 * lightly with citations drawn ONLY from the committed corpus (server-verified),
 * and gates display on ANSWER_CONFIDENCE_THRESHOLD — below it the answer is
 * suppressed and the subject is raised to a human via a review case.
 */
export async function POST(req: Request) {
  const sessionId = await getSessionId();
  const env = getEnv();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }
  const { messages, context, byok } = parsed.data;

  let provider = null;
  if (byok?.apiKey) {
    if (!byokEnabled()) return NextResponse.json(makeError("invalid_credentials"), { status: 200 });
    if (!isModelAllowed(byok.provider as ProviderName, byok.model)) {
      return NextResponse.json(makeError("unsupported_model"), { status: 200 });
    }
    provider = createByokProvider(byok);
  } else {
    provider = resolveServerProvider();
  }
  if (!provider) {
    return NextResponse.json({ ...makeError("insufficient_credits"), noServerKey: true }, { status: 200 });
  }

  const skill = skillOf(req);
  const threshold = env.ANSWER_CONFIDENCE_THRESHOLD;
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  agentModelQuery(skill, "answer", provider.name, provider.model, `${lastUser} (${messages.length} turn(s), threshold=${threshold})`);

  const started = Date.now();
  const outcome = await provider.answer(answerSystemPrompt(context), messages);
  const ms = Date.now() - started;

  if (!outcome.ok) {
    agentModelResponse(skill, "answer", ms, `failed: ${outcome.kind}`);
    return NextResponse.json(outcome, { status: 200 });
  }

  const a = sanitizeAnswer(outcome.data);
  if (!a) {
    agentModelResponse(skill, "answer", ms, "failed: invalid_output (schema)");
    return NextResponse.json(makeError("invalid_output"), { status: 200 });
  }

  // Invoice intent / small talk: no gating needed, no citations expected.
  if (a.kind !== "question") {
    agentModelResponse(skill, "answer", ms, `kind=${a.kind}${a.answer ? ` — "${a.answer}"` : ""}`);
    return NextResponse.json({
      ok: true,
      kind: a.kind,
      text: a.answer,
      confidence: a.confidence,
      citations: [],
      escalated: false,
      reviewCaseId: null,
    });
  }

  const citations = getCitations(a.relatedSourceIds);

  if (!passesThreshold(a.confidence, threshold)) {
    // Raise the subject to a human: suppress the answer, create a review case.
    const review = await getStorage().createReviewCase({
      sessionId,
      reason: `General question below confidence threshold (${a.confidence.toFixed(2)} < ${threshold})`,
      decisionCode: "GENERAL_QUESTION",
      customerName: "—",
      missingFacts: [],
      escalationReasons: ["low_confidence_general_answer"],
      expertQuestion: lastUser,
    });
    agentModelResponse(
      skill,
      "answer",
      ms,
      `kind=question confidence=${a.confidence.toFixed(2)} < threshold=${threshold} → escalated to human (review case created)`,
    );
    return NextResponse.json({
      ok: true,
      kind: a.kind,
      text: null,
      confidence: a.confidence,
      citations: [],
      escalated: true,
      reviewCaseId: review.id,
    });
  }

  agentModelResponse(
    skill,
    "answer",
    ms,
    `kind=question confidence=${a.confidence.toFixed(2)} ≥ threshold=${threshold} → answering (${citations.length} sources): "${a.answer}"`,
  );
  return NextResponse.json({
    ok: true,
    kind: a.kind,
    text: a.answer,
    confidence: a.confidence,
    citations,
    escalated: false,
    reviewCaseId: null,
  });
}
