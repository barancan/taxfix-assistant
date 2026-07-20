import { describe, expect, it } from "vitest";
import { fromMajor, mulMoney, percentOf, formatMajor, minorDigits, sumMoney, money } from "@/domain/money/money";
import { computeTotals } from "@/domain/invoice/totals";
import type { InvoiceLine } from "@/domain/invoice/schema";

describe("money — decimal-safe minor units", () => {
  it("parses major to minor correctly", () => {
    expect(fromMajor("12000", "USD").amountMinor).toBe("1200000");
    expect(fromMajor("1234.56", "EUR").amountMinor).toBe("123456");
    expect(fromMajor("1000", "JPY").amountMinor).toBe("1000");
  });

  it("knows minor-unit conventions", () => {
    expect(minorDigits("JPY")).toBe(0);
    expect(minorDigits("EUR")).toBe(2);
    expect(minorDigits("KWD")).toBe(3);
  });

  it("avoids float error (0.1 + 0.2 style)", () => {
    const sum = sumMoney([fromMajor("0.1", "EUR"), fromMajor("0.2", "EUR")], "EUR");
    expect(formatMajor(sum)).toBe("0.30");
  });

  it("rounds percentage half-up", () => {
    // 19% of 100.05 EUR = 19.0095 -> 19.01
    expect(percentOf(fromMajor("100.05", "EUR"), 19).amountMinor).toBe("1901");
  });

  it("multiplies fractional quantities", () => {
    // 7.5 hours * 90.00 EUR = 675.00
    expect(formatMajor(mulMoney(money("9000", "EUR"), "7.5"))).toBe("675.00");
  });
});

describe("invoice totals", () => {
  const lines: InvoiceLine[] = [
    { description: "Consulting", quantity: "10", unit: "hour", unitPriceMinor: "9000", isReimbursable: false },
    { description: "Design", quantity: "1", unit: "project", unitPriceMinor: "150000", isReimbursable: false },
  ];

  it("computes subtotal + VAT + total deterministically", () => {
    const t = computeTotals(lines, "EUR", { showVat: true, vatRate: 19 });
    expect(t.subtotalMinor).toBe("240000"); // 900.00 + 1500.00
    expect(t.vatMinor).toBe("45600"); // 19% of 2400.00
    expect(t.totalMinor).toBe("285600");
    expect(t.vatRate).toBe(19);
  });

  it("omits VAT when not shown (reverse charge / not taxable)", () => {
    const t = computeTotals(lines, "USD", { showVat: false });
    expect(t.vatMinor).toBe("0");
    expect(t.vatRate).toBeNull();
    expect(t.totalMinor).toBe(t.taxableMinor);
  });

  it("applies line and invoice discounts", () => {
    const withDiscount: InvoiceLine[] = [
      { description: "Work", quantity: "1", unit: "unit", unitPriceMinor: "100000", lineDiscount: { kind: "percent", value: "10" }, isReimbursable: false },
    ];
    const t = computeTotals(withDiscount, "EUR", { showVat: false }, { kind: "absolute", value: "5000" });
    expect(t.subtotalMinor).toBe("90000"); // 1000 - 10%
    expect(t.invoiceDiscountMinor).toBe("5000");
    expect(t.taxableMinor).toBe("85000");
  });
});
