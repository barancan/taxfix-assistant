import { getSessionId } from "@/server/session-server";
import { getStorage } from "@/server/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sessionId = await getSessionId();
  const storage = getStorage();

  const invoice = await storage.getInvoice(sessionId, id);
  if (!invoice) return new Response("Not found", { status: 404 });

  const bytes = await storage.getPdf(sessionId, id);
  if (!bytes) return new Response("PDF unavailable", { status: 404 });

  return new Response(bytes as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
