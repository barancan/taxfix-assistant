import type { VatTreatment } from "../schemas";

/** Stable rule identifiers = decision codes. Referenced by corpus + tests. */
export const RULE = {
  DE_STD_19: "DE_STD_19",
  DE_KU_19UStG: "DE_KU_19UStG",
  EU_RC_B2B: "EU_RC_B2B",
  NONEU_OOS: "NONEU_OOS",
  BLOCK_PRIVATE: "BLOCK_PRIVATE",
  BLOCK_SCOPE: "BLOCK_SCOPE",
  BLOCK_UNSUPPORTED_SERVICE: "BLOCK_UNSUPPORTED_SERVICE",
  ESCALATE_SPECIAL: "ESCALATE_SPECIAL",
} as const;

export type RuleId = (typeof RULE)[keyof typeof RULE];

/** Rule → required official source ids. The engine fails closed if any is invalid. */
export const RULE_SOURCES: Record<string, string[]> = {
  [RULE.DE_STD_19]: ["de-ustg-3a", "de-ustg-12", "de-ustg-14"],
  [RULE.DE_KU_19UStG]: ["de-ustg-19", "de-bmf-kleinunternehmer-2025", "de-ustg-14"],
  [RULE.EU_RC_B2B]: [
    "de-ustg-3a",
    "de-ustg-13b",
    "de-ustg-14a",
    "de-ustg-18a",
    "eu-vies",
    "de-ustg-14",
  ],
  [RULE.NONEU_OOS]: ["de-ustg-3a", "de-ustg-14"],
  [RULE.BLOCK_PRIVATE]: ["de-ustg-3a"],
  [RULE.BLOCK_SCOPE]: ["de-ustg-3a"],
  [RULE.BLOCK_UNSUPPORTED_SERVICE]: ["de-ustg-3a"],
  [RULE.ESCALATE_SPECIAL]: ["de-ustg-3a"],
};

/** Controlled wording template ids (resolved to language-specific text in the PDF). */
export const WORDING: Record<string, string[]> = {
  [RULE.DE_STD_19]: ["de_std_vat_line"],
  [RULE.DE_KU_19UStG]: ["kleinunternehmer_exempt_note"],
  [RULE.EU_RC_B2B]: ["reverse_charge_note"],
  [RULE.NONEU_OOS]: ["not_taxable_de_note"],
};

const BASE_INVOICE_FIELDS = [
  "supplier_name_address",
  "supplier_tax_number_or_vat_id",
  "customer_name_address",
  "invoice_date",
  "invoice_number",
  "service_description",
  "service_date_or_period",
  "net_amount",
];

export const REQUIRED_FIELDS: Record<string, string[]> = {
  [RULE.DE_STD_19]: [...BASE_INVOICE_FIELDS, "vat_rate", "vat_amount", "gross_total"],
  [RULE.DE_KU_19UStG]: [...BASE_INVOICE_FIELDS, "exemption_note"],
  [RULE.EU_RC_B2B]: [
    ...BASE_INVOICE_FIELDS,
    "supplier_vat_id",
    "customer_vat_id",
    "reverse_charge_note",
  ],
  [RULE.NONEU_OOS]: [...BASE_INVOICE_FIELDS, "not_taxable_de_note"],
};

export const TREATMENT: Record<string, VatTreatment> = {
  [RULE.DE_STD_19]: "standard",
  [RULE.DE_KU_19UStG]: "exempt_kleinunternehmer",
  [RULE.EU_RC_B2B]: "reverse_charge",
  [RULE.NONEU_OOS]: "not_taxable_de",
};

export const GERMAN_STANDARD_VAT_RATE = 19;
