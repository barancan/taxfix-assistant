import {
  DecisionInputSchema,
  DecisionResultSchema,
  type DecisionInput,
  type DecisionResult,
} from "../schemas";
import { checkSources } from "../corpus";
import { isVatIdFormatValid } from "./vatId";
import {
  GERMAN_STANDARD_VAT_RATE,
  REQUIRED_FIELDS,
  RULE,
  RULE_SOURCES,
  TREATMENT,
  WORDING,
} from "./codes";

/**
 * Deterministic VAT decision engine. PURE — imports no React, no provider SDK,
 * no Supabase, no PDF. It accepts normalized facts (validated at the boundary)
 * and returns a structured decision. The LLM never runs this logic and its
 * "confidence" is never treated as tax confidence.
 */

const HARD_BLOCK_FLAGS = new Set([
  "goods",
  "real_estate",
  "event_admission",
  "mixed_goods_services",
  "platform_deemed_supplier",
  "exempt_or_special_activity",
  "conflicting_evidence",
]);

const ESCALATE_FLAGS = new Set([
  "reduced_rate_ambiguity",
  "passthrough_disbursement",
  "multiple_establishments",
]);

export function decide(raw: unknown): DecisionResult {
  const input: DecisionInput = DecisionInputSchema.parse(raw);
  const asOf = input.transaction.invoiceDate;
  const { customer, evidence, service, transaction } = input;

  // ---- 1. Hard scope blocks (refused; no invoice, becomes a review case) ----
  if (customer.type === "private" || transaction.exceptionFlags.includes("private_customer")) {
    return finalize(RULE.BLOCK_PRIVATE, asOf, {
      status: "refused",
      vatTreatment: "blocked",
      boundaryStatements: [
        "Private (non-business) customers are outside the supported scope of this prototype.",
      ],
      escalationReasons: ["customer_is_private"],
      expertNote:
        "Is the customer acting as a business (with a valid business/VAT status) or as a private individual?",
    });
  }

  if (service.isGoods || hasAny(transaction.exceptionFlags, HARD_BLOCK_FLAGS)) {
    const trigger = service.isGoods ? "goods" : firstMatch(transaction.exceptionFlags, HARD_BLOCK_FLAGS);
    return finalize(RULE.BLOCK_SCOPE, asOf, {
      status: "refused",
      vatTreatment: "blocked",
      boundaryStatements: [
        `This transaction (${trigger}) is outside the supported scope: only ordinary B2B professional services are handled.`,
      ],
      escalationReasons: [`scope_${trigger}`],
      expertNote: `Confirm the correct VAT treatment for a transaction involving: ${trigger}.`,
    });
  }

  if (service.category === "unsupported" || !service.supported) {
    return finalize(RULE.BLOCK_UNSUPPORTED_SERVICE, asOf, {
      status: "escalate",
      vatTreatment: "blocked",
      boundaryStatements: [
        "The service could not be classified within the supported set of ordinary professional services.",
      ],
      escalationReasons: ["unsupported_service_category"],
      expertNote: "Which VAT treatment applies to this specific service?",
    });
  }

  if (hasAny(transaction.exceptionFlags, ESCALATE_FLAGS) || transaction.specialEstablishment || transaction.intermediaryInvolved) {
    const reason = transaction.specialEstablishment
      ? "special_establishment"
      : transaction.intermediaryInvolved
        ? "intermediary_involved"
        : firstMatch(transaction.exceptionFlags, ESCALATE_FLAGS);
    return finalize(RULE.ESCALATE_SPECIAL, asOf, {
      status: "escalate",
      vatTreatment: "blocked",
      boundaryStatements: ["A special-case indicator was detected that requires expert review."],
      escalationReasons: [reason],
      expertNote: `Confirm the VAT treatment given the special indicator: ${reason}.`,
    });
  }

  // ---- 2. Missing facts → needs_clarification ----
  const missing: string[] = [];
  if (customer.type === "unknown") missing.push("customer_business_status");
  if (!evidence.businessStatusConfirmedByUser) missing.push("business_status_confirmation");

  if (customer.region === "EU") {
    if (!customer.vatId) missing.push("customer_vat_id");
    else if (!isVatIdFormatValid(customer.vatId, customer.countryCode)) {
      // Present but implausible format is a real problem, not just "missing".
      return finalize(RULE.EU_RC_B2B, asOf, {
        status: "needs_clarification",
        vatTreatment: "reverse_charge",
        missingFacts: ["valid_customer_vat_id"],
        boundaryStatements: [
          "The customer VAT ID is not in a plausible format for its country. Live VIES is not called in this prototype.",
        ],
      });
    }
  }

  if (missing.length > 0) {
    const rule = pickRule(input);
    return finalize(rule, asOf, {
      status: "needs_clarification",
      vatTreatment: TREATMENT[rule] ?? "blocked",
      missingFacts: missing,
      boundaryStatements: ["Confirm the outstanding facts before a decision can be issued."],
    });
  }

  // ---- 3. Supported decision paths ----
  const rule = pickRule(input);

  if (rule === RULE.DE_STD_19) {
    return finalize(rule, asOf, {
      status: "approved",
      vatTreatment: "standard",
      germanVatRate: GERMAN_STANDARD_VAT_RATE,
      showGermanVat: true,
      boundaryStatements: [
        "Domestic German B2B supply of an ordinary professional service at the standard rate. Reduced-rate and exempt services are out of scope.",
      ],
      invoiceGenerationAllowed: true,
    });
  }

  if (rule === RULE.DE_KU_19UStG) {
    return finalize(rule, asOf, {
      status: "approved",
      vatTreatment: "exempt_kleinunternehmer",
      boundaryStatements: [
        "Small-business exemption (§19 UStG) applied per the active profile; no VAT is charged and no input-VAT deduction is available. Turnover thresholds are assumed met as declared.",
      ],
      invoiceGenerationAllowed: true,
    });
  }

  if (rule === RULE.EU_RC_B2B) {
    return finalize(rule, asOf, {
      status: "approved",
      vatTreatment: "reverse_charge",
      boundaryStatements: [
        "Intra-EU B2B general-rule service: place of supply is the customer's country, no German VAT, reverse charge applies in the customer's country.",
        evidence.vatIdCheck === "demo_vies"
          ? "VAT ID shown as verified via a mocked 'Demo verification' — live VIES was not called."
          : "Only the VAT ID format was checked; live VIES was not called.",
      ],
      reportingHints: [
        "A recapitulative statement (Zusammenfassende Meldung, §18a UStG) is likely due for this intra-EU B2B service.",
      ],
      invoiceGenerationAllowed: true,
    });
  }

  // NONEU_OOS
  return finalize(RULE.NONEU_OOS, asOf, {
    status: "approved",
    vatTreatment: "not_taxable_de",
    sourcesExtra: transaction.currency.toUpperCase() !== "EUR" ? ["ecb-exr"] : [],
    boundaryStatements: [
      "Place of supply is the customer's country (outside the EU) → the service is not taxable in Germany; no German VAT is shown.",
      "Foreign (customer-country) tax obligations have not been determined by this prototype.",
      transaction.currency.toUpperCase() !== "EUR"
        ? "The EUR figure is accounting metadata derived from the ECB reference rate; the customer-facing amount stays in the original currency."
        : "",
    ].filter(Boolean),
    invoiceGenerationAllowed: true,
  });
}

function pickRule(input: DecisionInput): string {
  const { profile, customer } = input;
  if (customer.region === "DE") {
    return profile.kleinunternehmer ? RULE.DE_KU_19UStG : RULE.DE_STD_19;
  }
  if (customer.region === "EU") return RULE.EU_RC_B2B;
  return RULE.NONEU_OOS;
}

interface PartialResult {
  status: DecisionResult["status"];
  vatTreatment: DecisionResult["vatTreatment"];
  germanVatRate?: number;
  showGermanVat?: boolean;
  missingFacts?: string[];
  boundaryStatements?: string[];
  escalationReasons?: string[];
  reportingHints?: string[];
  invoiceGenerationAllowed?: boolean;
  sourcesExtra?: string[];
  expertNote?: string;
}

function finalize(rule: string, asOf: string, p: PartialResult): DecisionResult {
  const sources = [...(RULE_SOURCES[rule] ?? []), ...(p.sourcesExtra ?? [])];
  const check = checkSources(sources, asOf);

  const escalation = [...(p.escalationReasons ?? [])];
  let status = p.status;
  let allowInvoice = p.invoiceGenerationAllowed ?? false;
  const boundary = [...(p.boundaryStatements ?? [])];

  // Fail closed: an invalid/missing/expired source can never yield an approval.
  if (!check.ok) {
    status = "escalate";
    allowInvoice = false;
    escalation.push("source_missing_or_invalid");
    if (check.missing.length) boundary.push(`Missing corpus source(s): ${check.missing.join(", ")}.`);
    if (check.expired.length) boundary.push(`Expired corpus source(s): ${check.expired.join(", ")}.`);
    if (check.unverified.length) boundary.push(`Unverified corpus source(s): ${check.unverified.join(", ")}.`);
    if (check.notYetEffective.length)
      boundary.push(`Source(s) not yet effective: ${check.notYetEffective.join(", ")}.`);
  }

  // Only an "approved" status may permit invoice generation.
  if (status !== "approved") allowInvoice = false;

  if (p.expertNote) boundary.push(`Question for a tax expert: ${p.expertNote}`);

  const result: DecisionResult = {
    status,
    decisionCode: rule,
    ruleId: rule,
    vatTreatment: p.vatTreatment,
    germanVatRate: p.germanVatRate ?? null,
    showGermanVat: p.showGermanVat ?? false,
    wordingIds: status === "approved" ? (WORDING[rule] ?? []) : [],
    requiredInvoiceFields: REQUIRED_FIELDS[rule] ?? [],
    sourceIds: sources,
    boundaryStatements: boundary,
    missingFacts: p.missingFacts ?? [],
    escalationReasons: escalation,
    reportingHints: p.reportingHints ?? [],
    eInvoiceStatus: status === "approved" ? "mock_ready" : "not_applicable",
    invoiceGenerationAllowed: allowInvoice,
  };

  // Validate our own output — the engine trusts nothing, including itself.
  return DecisionResultSchema.parse(result);
}

function hasAny(flags: string[], set: Set<string>): boolean {
  return flags.some((f) => set.has(f));
}
function firstMatch(flags: string[], set: Set<string>): string {
  return flags.find((f) => set.has(f)) ?? "unknown";
}
