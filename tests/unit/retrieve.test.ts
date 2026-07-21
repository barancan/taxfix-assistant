import { describe, expect, it } from "vitest";
import { retrieve, tokenize } from "@/domain/knowledge/retrieve";
import { KNOWLEDGE } from "@/domain/knowledge";

describe("knowledge retrieval (lexical)", () => {
  it("tokenizes and drops stopwords", () => {
    expect(tokenize("What is my VAT ID?")).toEqual(["vat", "id"]);
  });

  it("surfaces the Kleinunternehmer entry for the screenshot question", () => {
    const hits = retrieve("walk me through the things I can do as a Kleinunternehmer");
    expect(hits[0]?.entry.entryId).toBe("kleinunternehmer");
    expect(hits[0]!.score).toBeGreaterThan(0.3);
  });

  it("answers 'what should an invoice contain' with a strongly-ranked entry (regression)", () => {
    const hits = retrieve("What should a freelancer invoice contain");
    expect(hits[0]?.entry.entryId).toBe("invoice-fields");
    expect(hits[0]!.score).toBeGreaterThan(0.5);
  });

  it("grounds a filing-deadline question (regression)", () => {
    const hits = retrieve("when should I submit my income statement for 2025?");
    expect(hits[0]?.entry.entryId).toBe("filing-deadlines");
    expect(hits[0]!.score).toBeGreaterThan(0.5);
  });

  it("surfaces the reverse-charge entry", () => {
    const hits = retrieve("what does reverse charge mean on my invoice");
    expect(hits[0]?.entry.entryId).toBe("reverse-charge");
  });

  it("surfaces the identifiers entry for tax-number vs VAT-ID", () => {
    const hits = retrieve("difference between tax number and VAT ID");
    expect(hits.map((h) => h.entry.entryId)).toContain("tax-identifiers");
  });

  it("surfaces ELSTER", () => {
    expect(retrieve("what is ELSTER")[0]?.entry.entryId).toBe("elster");
  });

  it("returns nothing above the floor for off-topic questions", () => {
    const hits = retrieve("what is the weather in Berlin tomorrow");
    const top = hits[0]?.score ?? 0;
    expect(top).toBeLessThan(0.3);
  });

  it("scores are normalized within [0,1] and sorted descending", () => {
    const hits = retrieve("Kleinunternehmer VAT invoice");
    for (const h of hits) {
      expect(h.score).toBeGreaterThan(0);
      expect(h.score).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < hits.length; i++) expect(hits[i - 1]!.score).toBeGreaterThanOrEqual(hits[i]!.score);
  });

  it("covers the freelancer-basics topic range", () => {
    const ids = KNOWLEDGE.map((e) => e.entryId);
    for (const expected of ["kleinunternehmer", "tax-identifiers", "freelancer-registration", "elster", "vat-return-cadence", "income-tax-vs-vat"]) {
      expect(ids).toContain(expected);
    }
  });
});
