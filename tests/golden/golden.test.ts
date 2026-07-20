import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decide } from "@/domain/vat/engine";

interface GoldenExpected {
  status: string;
  decisionCode: string;
  vatTreatment: string;
  showGermanVat: boolean;
  germanVatRate: number | null;
  invoiceGenerationAllowed: boolean;
  expectedSourceIds: string[];
  reportingHintsNonEmpty?: boolean;
  missingFacts?: string[];
}
interface GoldenCase {
  name: string;
  input: unknown;
  expected: GoldenExpected;
}

const DIR = join(process.cwd(), "fixtures", "golden");
const files = readdirSync(DIR).filter((f) => f.endsWith(".json")).sort();

describe("golden VAT decision scenarios", () => {
  it("has all five required scenarios", () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of files) {
    const gc = JSON.parse(readFileSync(join(DIR, file), "utf8")) as GoldenCase;
    it(`${file} → ${gc.name}`, () => {
      const result = decide(gc.input);
      const e = gc.expected;
      expect(result.status).toBe(e.status);
      expect(result.decisionCode).toBe(e.decisionCode);
      expect(result.vatTreatment).toBe(e.vatTreatment);
      expect(result.showGermanVat).toBe(e.showGermanVat);
      expect(result.germanVatRate).toBe(e.germanVatRate);
      expect(result.invoiceGenerationAllowed).toBe(e.invoiceGenerationAllowed);
      expect(result.sourceIds).toEqual(e.expectedSourceIds);

      if (e.reportingHintsNonEmpty) {
        expect(result.reportingHints.length).toBeGreaterThan(0);
      }
      if (e.missingFacts) {
        expect(result.missingFacts).toEqual(e.missingFacts);
      }

      // Trust-boundary invariant: only approvals may permit invoice generation.
      if (result.status !== "approved") {
        expect(result.invoiceGenerationAllowed).toBe(false);
      }
    });
  }
});
