import "server-only";
import { renderToBuffer } from "@react-pdf/renderer";
import { InvoiceDocument } from "./InvoiceDocument";
import type { InvoiceViewModel } from "./model";

/** Render the controlled invoice template to PDF bytes (server-side only). */
export async function renderInvoicePdf(vm: InvoiceViewModel): Promise<Uint8Array> {
  const buf = await renderToBuffer(<InvoiceDocument vm={vm} />);
  return new Uint8Array(buf);
}
