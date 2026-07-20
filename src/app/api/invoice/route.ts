import { NextResponse } from "next/server";
import { getSessionId } from "@/server/session-server";
import { InvoicePayloadSchema, generateInvoice } from "@/server/invoice-service";

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
  const result = await generateInvoice(sessionId, parsed.data);
  if (!result.ok) {
    return NextResponse.json(result, { status: 409 });
  }
  return NextResponse.json(result);
}
