import { NextResponse } from "next/server";
import { getSessionId } from "@/server/session-server";
import { InvoicePayloadSchema, generateInvoice } from "@/server/invoice-service";
import { agentAction, agentResult, skillOf } from "@/server/agent-log";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sessionId = await getSessionId();
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = InvoicePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", issues: parsed.error.issues }, { status: 400 });
  }
  const skill = skillOf(req);
  const p = parsed.data;
  agentAction(
    skill,
    "generate-invoice",
    `customer="${p.facts.customer.name}", ${p.draft.lines.length} line(s), currency=${p.draft.currency}`,
  );
  const result = await generateInvoice(sessionId, parsed.data);
  if (!result.ok) {
    agentResult(skill, "generate-invoice", `BLOCKED (${result.decisionCode}) — no invoice issued${result.reviewCaseId ? ", review case created" : ""}`);
    return NextResponse.json(result, { status: 409 });
  }
  agentResult(
    skill,
    "generate-invoice",
    `${result.invoice.status === "issued" ? "issued" : "FAILED after numbering"} ${result.invoice.invoiceNumber} — total ${result.invoice.totalMinor} minor ${result.invoice.currency}${result.invoice.fx ? ` (EUR metadata ${result.invoice.fx.eurAmountMinor})` : ""}`,
  );
  return NextResponse.json(result);
}
