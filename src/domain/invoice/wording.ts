/**
 * Controlled, language-specific legal/VAT wording. Mandatory tax wording MUST
 * come from here — never from the LLM. Ordinary descriptive content (line item
 * text, notes) may be free text, but these strings are fixed templates.
 */

export type InvoiceLanguage = "en" | "de";

export interface WordingContext {
  vatRate?: number;
}

const TEMPLATES: Record<string, Record<InvoiceLanguage, (c: WordingContext) => string>> = {
  de_std_vat_line: {
    en: (c) => `VAT is charged at the German standard rate of ${c.vatRate ?? 19}%.`,
    de: (c) => `Es wird die gesetzliche deutsche Umsatzsteuer von ${c.vatRate ?? 19}% berechnet.`,
  },
  kleinunternehmer_exempt_note: {
    en: () =>
      "No VAT is charged. Tax-exempt small business under §19 UStG (Kleinunternehmer).",
    de: () =>
      "Kein Ausweis von Umsatzsteuer. Steuerbefreiung für Kleinunternehmer gemäß §19 UStG.",
  },
  reverse_charge_note: {
    en: () =>
      "Reverse charge: VAT is to be accounted for by the recipient — Steuerschuldnerschaft des Leistungsempfängers (§13b/§14a UStG).",
    de: () => "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge, §13b/§14a UStG).",
  },
  not_taxable_de_note: {
    en: () =>
      "Not subject to German VAT: the place of supply is the customer's country (§3a(2) UStG). Foreign tax obligations have not been assessed.",
    de: () =>
      "Nicht steuerbar in Deutschland: Leistungsort ist das Empfängerland (§3a Abs. 2 UStG). Ausländische Steuerpflichten wurden nicht geprüft.",
  },
};

export function getWording(
  wordingId: string,
  language: InvoiceLanguage,
  ctx: WordingContext = {},
): string {
  const t = TEMPLATES[wordingId]?.[language];
  if (!t) {
    // Fail visibly rather than emitting silent/incorrect legal text.
    throw new Error(`No controlled wording template for "${wordingId}" (${language})`);
  }
  return t(ctx);
}

export function hasWording(wordingId: string): boolean {
  return wordingId in TEMPLATES;
}
