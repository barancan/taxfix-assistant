import { NextResponse } from "next/server";
import { getSessionId } from "@/server/session-server";
import { getStorage, storageMode } from "@/server/storage";

export async function GET() {
  const sessionId = await getSessionId();
  const invoices = await getStorage().listInvoices(sessionId);
  return NextResponse.json({ invoices, storageMode: storageMode() });
}
