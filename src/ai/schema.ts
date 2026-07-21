import { z } from "zod";

/**
 * Extraction output schema. The model ONLY extracts descriptive fields from
 * untrusted document/text content. It never decides tax treatment, region,
 * customer legal status, amounts-as-authoritative, or invoice permission — those
 * are user-confirmed and/or computed deterministically downstream.
 *
 * Optional fields are modelled as nullable so the same JSON Schema can be used
 * with OpenAI strict Structured Outputs (all keys required) and Anthropic tools.
 */
const nullableString = z.string().nullable();

export const ExtractionResultSchema = z.object({
  customerName: nullableString,
  customerCountryName: nullableString,
  customerCountryCode: nullableString,
  customerVatId: nullableString,
  customerAddressLines: z.array(z.string()),
  serviceDescription: nullableString,
  suggestedCategory: z
    .enum([
      "software_development",
      "consulting",
      "design",
      "marketing",
      "translation",
      "research",
      "other_professional_service",
      "unsupported",
    ])
    .nullable(),
  currency: nullableString,
  amountMajor: nullableString,
  invoiceDate: nullableString,
  lineItems: z.array(
    z.object({
      description: z.string(),
      quantity: nullableString,
      unitPriceMajor: nullableString,
    }),
  ),
  missingHints: z.array(z.string()),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

/** JSON Schema mirror (strict) used by both providers. */
export const EXTRACTION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    customerName: { type: ["string", "null"] },
    customerCountryName: { type: ["string", "null"] },
    customerCountryCode: { type: ["string", "null"], description: "ISO 3166-1 alpha-2" },
    customerVatId: { type: ["string", "null"] },
    customerAddressLines: { type: "array", items: { type: "string" } },
    serviceDescription: { type: ["string", "null"] },
    suggestedCategory: {
      type: ["string", "null"],
      enum: [
        "software_development",
        "consulting",
        "design",
        "marketing",
        "translation",
        "research",
        "other_professional_service",
        "unsupported",
        null,
      ],
    },
    currency: { type: ["string", "null"], description: "ISO 4217" },
    amountMajor: { type: ["string", "null"] },
    invoiceDate: { type: ["string", "null"], description: "YYYY-MM-DD" },
    lineItems: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          description: { type: "string" },
          quantity: { type: ["string", "null"] },
          unitPriceMajor: { type: ["string", "null"] },
        },
        required: ["description", "quantity", "unitPriceMajor"],
      },
    },
    missingHints: { type: "array", items: { type: "string" } },
  },
  required: [
    "customerName",
    "customerCountryName",
    "customerCountryCode",
    "customerVatId",
    "customerAddressLines",
    "serviceDescription",
    "suggestedCategory",
    "currency",
    "amountMajor",
    "invoiceDate",
    "lineItems",
    "missingHints",
  ],
} as const;

export const EXTRACTION_TOOL_NAME = "record_extracted_invoice_fields";
