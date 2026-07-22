import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionId } from "@/server/session-server";
import { getStorage } from "@/server/storage";
import { ClientFactsSchema } from "@/server/decision-service";
import { agentAction, agentResult, skillOf } from "@/server/agent-log";

export const runtime = "nodejs";

const BodySchema = z.object({
  facts: ClientFactsSchema,
  reason: z.string().min(1).max(300),
  question: z.string().min(1).max(500),
});

/**
 * User-initiated escalation — when a case can't be completed automatically (e.g.
 * an EU B2B customer with no VAT ID), the user can hand it to a tax expert. This
 * creates a review case; it never issues an invoice or number.
 */
export async function POST(req: Request) {
  const sessionId = await getSessionId();
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
  const { facts, reason, question } = parsed.data;
  const skill = skillOf(req);
  agentAction(skill, "escalate", `user requested expert help — ${reason}`);

  const review = await getStorage().createReviewCase({
    sessionId,
    reason,
    decisionCode: "USER_ESCALATION",
    customerName: facts.customer.name,
    missingFacts: [],
    escalationReasons: ["user_requested"],
    expertQuestion: question,
  });

  agentResult(skill, "escalate", `review case created (${review.id})`);
  return NextResponse.json({ reviewCaseId: review.id });
}
