import { describe, expect, it } from "vitest";
import { isVatIdFormatValid, normalizeVatId, vatIdCountry } from "@/domain/vat/vatId";

describe("VAT id format validation (never contacts VIES)", () => {
  it("accepts a plausible Portuguese id", () => {
    expect(isVatIdFormatValid("PT123456789", "PT")).toBe(true);
    expect(isVatIdFormatValid("PT 123 456 789", "PT")).toBe(true);
  });

  it("rejects an implausible id", () => {
    expect(isVatIdFormatValid("PT12", "PT")).toBe(false);
    expect(isVatIdFormatValid(undefined, "PT")).toBe(false);
  });

  it("rejects a country-prefix mismatch", () => {
    expect(isVatIdFormatValid("DE123456789", "PT")).toBe(false);
  });

  it("normalizes and detects country", () => {
    expect(normalizeVatId("de123.456-789")).toBe("DE123456789");
    expect(vatIdCountry("PT123456789")).toBe("PT");
    expect(vatIdCountry("US123")).toBeNull();
  });
});
