import { z } from "zod";
import { isoDate } from "../schemas";

export const DiscountSchema = z.object({
  kind: z.enum(["percent", "absolute"]),
  /** percent: "10" = 10%; absolute: minor units as string */
  value: z.string(),
});
export type Discount = z.infer<typeof DiscountSchema>;

export const InvoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.string().default("1"),
  unit: z.string().default("unit"),
  unitPriceMinor: z.string(),
  lineDiscount: DiscountSchema.optional(),
  isReimbursable: z.boolean().default(false),
});
export type InvoiceLine = z.infer<typeof InvoiceLineSchema>;

export const FxMetadataSchema = z.object({
  baseCurrency: z.literal("EUR"),
  quoteCurrency: z.string().length(3),
  originalAmountMinor: z.string(),
  eurAmountMinor: z.string(),
  rate: z.string(),
  rateDirection: z.literal("UNITS_PER_EUR"),
  ecbSeriesKey: z.string(),
  sourceUrl: z.string().url(),
  requestedDate: isoDate,
  actualRateDate: isoDate,
  retrievedAt: z.string(),
});
export type FxMetadata = z.infer<typeof FxMetadataSchema>;

export const InvoiceDraftSchema = z.object({
  currency: z.string().length(3),
  lines: z.array(InvoiceLineSchema).min(1),
  invoiceDiscount: DiscountSchema.optional(),
  invoiceDate: isoDate,
  serviceDate: isoDate.optional(),
  paymentTermsDays: z.number().int().nonnegative().default(14),
  notes: z.string().optional(),
});
export type InvoiceDraft = z.infer<typeof InvoiceDraftSchema>;

export interface LineTotal {
  grossMinor: string;
  discountMinor: string;
  netMinor: string;
}

export interface InvoiceTotals {
  currency: string;
  lines: LineTotal[];
  subtotalMinor: string;
  invoiceDiscountMinor: string;
  taxableMinor: string;
  vatRate: number | null;
  vatMinor: string;
  totalMinor: string;
}
