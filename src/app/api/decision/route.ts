import { NextResponse } from "next/server";
import { getSessionId } from "@/server/session-server";
import { storageMode } from "@/server/storage";
import { ClientFactsSchema, evaluate, persistDecision } from "@/server/decision-service";

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
  const { decision, citations } = evaluate(sessionId, parsed.data);
  const { reviewCaseId } = await persistDecision(sessionId, parsed.data, decision);
  return NextResponse.json({ decision, citations, reviewCaseId, storageMode: storageMode() });
}
