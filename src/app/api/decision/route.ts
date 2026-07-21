import { NextResponse } from "next/server";
import { getSessionId } from "@/server/session-server";
import { storageMode } from "@/server/storage";
import { ClientFactsSchema, evaluate, persistDecision } from "@/server/decision-service";
import { agentAction, agentResult, skillOf } from "@/server/agent-log";

export async function POST(req: Request) {
  const sessionId = await getSessionId();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = ClientFactsSchema.safeParse((body as { facts?: unknown })?.facts ?? body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_facts", issues: parsed.error.issues }, { status: 400 });
  }
  const skill = skillOf(req);
  const f = parsed.data;
  agentAction(
    skill,
    "vat-engine",
    `evaluating: ${f.customer.type} customer in ${f.customer.countryCode} (${f.customer.region}), service=${f.service.category}, currency=${f.transaction.currency}`,
  );
  const { decision, citations } = evaluate(sessionId, parsed.data);
  const { reviewCaseId } = await persistDecision(sessionId, parsed.data, decision);
  agentResult(
    skill,
    "vat-engine",
    `${decision.decisionCode} ${decision.status}: ${decision.vatTreatment}${decision.germanVatRate ? ` @ ${decision.germanVatRate}%` : ""} (${citations.length} sources)${reviewCaseId ? " · review case created" : ""}`,
  );
  return NextResponse.json({ decision, citations, reviewCaseId, storageMode: storageMode() });
}
