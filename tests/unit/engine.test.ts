import { describe, expect, it } from "vitest";
import { decide } from "@/domain/vat/engine";
import type { DecisionInput } from "@/domain/schemas";

function baseInput(overrides: Partial<DecisionInput> = {}): DecisionInput {
  return {
    taxYear: 2026,
    profile: {
      establishmentCountry: "DE",
      taxResidence: "DE",
      kleinunternehmer: false,
      vatRegistered: true,
      taxNumberPresent: true,
      vatIdPresent: true,
    },
    customer: { name: "Acme GmbH", countryCode: "DE", region: "DE", type: "business" },
    evidence: { vatIdCheck: "none", businessStatusConfirmedByUser: true, source: "manual" },
    service: {
      category: "consulting",
      normalizedDescription: "Consulting",
      isGoods: false,
      supported: true,
    },
    transaction: {
      invoiceDate: "2026-07-21",
      currency: "EUR",
      intermediaryInvolved: false,
      specialEstablishment: false,
      exceptionFlags: [],
    },
    ...overrides,
  };
}

describe("VAT engine — trust boundary & fail-closed", () => {
  it("hard-blocks private customers with no invoice", () => {
    const r = decide(baseInput({ customer: { name: "Jane", countryCode: "DE", region: "DE", type: "private" } }));
    expect(r.status).toBe("refused");
    expect(r.decisionCode).toBe("BLOCK_PRIVATE");
    expect(r.invoiceGenerationAllowed).toBe(false);
    expect(r.wordingIds).toHaveLength(0);
  });

  it("hard-blocks goods", () => {
    const r = decide(
      baseInput({
        service: { category: "other_professional_service", normalizedDescription: "Widgets", isGoods: true, supported: true },
      }),
    );
    expect(r.status).toBe("refused");
    expect(r.decisionCode).toBe("BLOCK_SCOPE");
    expect(r.invoiceGenerationAllowed).toBe(false);
  });

  it("hard-blocks real-estate / event exception flags", () => {
    for (const flag of ["real_estate", "event_admission", "mixed_goods_services", "platform_deemed_supplier"] as const) {
      const r = decide(baseInput({ transaction: { ...baseInput().transaction, exceptionFlags: [flag] } }));
      expect(r.status).toBe("refused");
      expect(r.decisionCode).toBe("BLOCK_SCOPE");
    }
  });

  it("escalates special-establishment and intermediary cases", () => {
    const r1 = decide(baseInput({ transaction: { ...baseInput().transaction, specialEstablishment: true } }));
    expect(r1.status).toBe("escalate");
    const r2 = decide(baseInput({ transaction: { ...baseInput().transaction, intermediaryInvolved: true } }));
    expect(r2.status).toBe("escalate");
    expect(r2.invoiceGenerationAllowed).toBe(false);
  });

  it("escalates unsupported service categories", () => {
    const r = decide(
      baseInput({ service: { category: "unsupported", normalizedDescription: "???", isGoods: false, supported: false } }),
    );
    expect(r.status).toBe("escalate");
    expect(r.decisionCode).toBe("BLOCK_UNSUPPORTED_SERVICE");
  });

  it("asks for clarification when business status is not confirmed", () => {
    const r = decide(baseInput({ evidence: { vatIdCheck: "none", businessStatusConfirmedByUser: false, source: "manual" } }));
    expect(r.status).toBe("needs_clarification");
    expect(r.missingFacts).toContain("business_status_confirmation");
    expect(r.invoiceGenerationAllowed).toBe(false);
  });

  it("asks for a VAT id when an EU customer has none", () => {
    const r = decide(
      baseInput({ customer: { name: "EU Co", countryCode: "PT", region: "EU", type: "business" } }),
    );
    expect(r.status).toBe("needs_clarification");
    expect(r.missingFacts).toContain("customer_vat_id");
  });

  it("flags an implausible EU VAT id format (no live VIES claim)", () => {
    const r = decide(
      baseInput({
        customer: { name: "EU Co", countryCode: "PT", region: "EU", type: "business", vatId: "PT12" },
        evidence: { vatIdCheck: "format_only", businessStatusConfirmedByUser: true, source: "extracted" },
      }),
    );
    expect(r.status).toBe("needs_clarification");
    expect(r.missingFacts).toContain("valid_customer_vat_id");
  });

  it("Kleinunternehmer path shows no VAT", () => {
    const r = decide(baseInput({ profile: { ...baseInput().profile, kleinunternehmer: true } }));
    expect(r.decisionCode).toBe("DE_KU_19UStG");
    expect(r.showGermanVat).toBe(false);
    expect(r.germanVatRate).toBeNull();
  });

  it("US path adds ECB source only for non-EUR currency", () => {
    const usd = decide(
      baseInput({
        customer: { name: "US Inc", countryCode: "US", region: "NON_EU", type: "business" },
        transaction: { ...baseInput().transaction, currency: "USD" },
      }),
    );
    expect(usd.sourceIds).toContain("ecb-exr");
    const eur = decide(
      baseInput({ customer: { name: "US Inc", countryCode: "US", region: "NON_EU", type: "business" } }),
    );
    expect(eur.sourceIds).not.toContain("ecb-exr");
  });
});
