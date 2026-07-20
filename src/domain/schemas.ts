import { z } from "zod";

/**
 * Domain schemas (single source of truth for facts that cross the trust
 * boundary). This module is PURE: no React, no provider SDK, no Supabase, no
 * PDF. Everything the AI produces must pass one of these schemas before it can
 * influence a tax decision.
 */

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const RegionSchema = z.enum(["DE", "EU", "NON_EU"]);
export type Region = z.infer<typeof RegionSchema>;

export const CustomerTypeSchema = z.enum(["business", "private", "unknown"]);
export type CustomerType = z.infer<typeof CustomerTypeSchema>;

export const ServiceCategorySchema = z.enum([
  "software_development",
  "consulting",
  "design",
  "marketing",
  "translation",
  "research",
  "other_professional_service",
  "unsupported",
]);
export type ServiceCategory = z.infer<typeof ServiceCategorySchema>;

export const DecisionStatusSchema = z.enum([
  "approved",
  "needs_clarification",
  "escalate",
  "refused",
]);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const VatTreatmentSchema = z.enum([
  "standard",
  "exempt_kleinunternehmer",
  "reverse_charge",
  "not_taxable_de",
  "blocked",
]);
export type VatTreatment = z.infer<typeof VatTreatmentSchema>;

export const VatIdCheckSchema = z.enum(["none", "format_only", "demo_vies"]);

/** Known scope-exception flags that force escalation or a hard block. */
export const ExceptionFlagSchema = z.enum([
  "goods",
  "private_customer",
  "real_estate",
  "event_admission",
  "mixed_goods_services",
  "platform_deemed_supplier",
  "multiple_establishments",
  "exempt_or_special_activity",
  "reduced_rate_ambiguity",
  "passthrough_disbursement",
  "conflicting_evidence",
]);
export type ExceptionFlag = z.infer<typeof ExceptionFlagSchema>;

export const ProfileFactsSchema = z.object({
  establishmentCountry: z.literal("DE"),
  taxResidence: z.literal("DE"),
  kleinunternehmer: z.boolean(),
  vatRegistered: z.boolean(),
  taxNumberPresent: z.boolean(),
  vatIdPresent: z.boolean(),
});
export type ProfileFacts = z.infer<typeof ProfileFactsSchema>;

export const CustomerFactsSchema = z.object({
  name: z.string().min(1),
  countryCode: z.string().length(2),
  region: RegionSchema,
  type: CustomerTypeSchema,
  vatId: z.string().optional(),
});
export type CustomerFacts = z.infer<typeof CustomerFactsSchema>;

export const CustomerEvidenceSchema = z.object({
  vatIdFormatValid: z.boolean().optional(),
  vatIdCheck: VatIdCheckSchema,
  businessStatusConfirmedByUser: z.boolean(),
  source: z.enum(["manual", "extracted"]),
});
export type CustomerEvidence = z.infer<typeof CustomerEvidenceSchema>;

export const ServiceFactsSchema = z.object({
  category: ServiceCategorySchema,
  normalizedDescription: z.string(),
  isGoods: z.boolean(),
  supported: z.boolean(),
});
export type ServiceFacts = z.infer<typeof ServiceFactsSchema>;

export const TransactionFactsSchema = z.object({
  invoiceDate: isoDate,
  serviceDate: isoDate.optional(),
  currency: z.string().length(3),
  intermediaryInvolved: z.boolean(),
  specialEstablishment: z.boolean(),
  exceptionFlags: z.array(ExceptionFlagSchema),
});
export type TransactionFacts = z.infer<typeof TransactionFactsSchema>;

/** The ONLY input accepted by the deterministic VAT engine. */
export const DecisionInputSchema = z.object({
  taxYear: z.number().int(),
  profile: ProfileFactsSchema,
  customer: CustomerFactsSchema,
  evidence: CustomerEvidenceSchema,
  service: ServiceFactsSchema,
  transaction: TransactionFactsSchema,
});
export type DecisionInput = z.infer<typeof DecisionInputSchema>;

export const DecisionResultSchema = z.object({
  status: DecisionStatusSchema,
  decisionCode: z.string(),
  ruleId: z.string(),
  vatTreatment: VatTreatmentSchema,
  germanVatRate: z.number().nullable(),
  showGermanVat: z.boolean(),
  wordingIds: z.array(z.string()),
  requiredInvoiceFields: z.array(z.string()),
  sourceIds: z.array(z.string()),
  boundaryStatements: z.array(z.string()),
  missingFacts: z.array(z.string()),
  escalationReasons: z.array(z.string()),
  reportingHints: z.array(z.string()),
  eInvoiceStatus: z.enum(["not_applicable", "mock_ready"]),
  invoiceGenerationAllowed: z.boolean(),
});
export type DecisionResult = z.infer<typeof DecisionResultSchema>;
