import { getSessionId } from "@/server/session-server";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sessionId = await getSessionId();
  const storage = getStorage();
  const sid = sessionId.slice(0, 8);

  console.info(`[pdf] request id=${id} sid=${sid} storage=${storage.mode}`);

  const invoice = await storage.getInvoice(sessionId, id);
  if (!invoice) {
    console.warn(`[pdf] 404 invoice-not-found id=${id} sid=${sid} (wrong session or no such invoice)`);
    return new Response("Not found", { status: 404 });
  }

  const bytes = await storage.getPdf(sessionId, id);
  if (!bytes) {
    console.warn(`[pdf] 404 bytes-missing id=${id} number=${invoice.invoiceNumber} status=${invoice.status} pdfPath=${invoice.pdfPath}`);
    return new Response("PDF unavailable", { status: 404 });
  }

  console.info(`[pdf] 200 serving ${invoice.invoiceNumber} bytes=${bytes.byteLength}`);
  return new Response(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
      "content-length": String(bytes.byteLength),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
