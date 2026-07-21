import { describe, expect, it } from "vitest";
import { CORPUS, checkSources, getSource } from "@/domain/corpus";
import { RULE_SOURCES } from "@/domain/vat/codes";

describe("official source corpus", () => {
  it("loads and validates every source", () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(9);
    for (const s of CORPUS) {
      expect(s.verificationStatus).toBe("verified");
      expect(s.url).toMatch(/^https:\/\//);
      // Every source must carry a controlled English translation for the UI.
      expect(s.officialTitleEn.length).toBeGreaterThan(0);
      expect(s.excerptEn.length).toBeGreaterThan(0);
    }
  });

  it("every rule maps only to sources that exist and are valid today", () => {
    const today = "2026-07-21";
    for (const [rule, ids] of Object.entries(RULE_SOURCES)) {
      const check = checkSources(ids, today);
      expect(check.missing, `rule ${rule} missing`).toEqual([]);
      expect(check.ok, `rule ${rule} sources invalid`).toBe(true);
    }
  });

  it("detects a missing source (fail-closed signal)", () => {
    const check = checkSources(["does-not-exist"], "2026-07-21");
    expect(check.ok).toBe(false);
    expect(check.missing).toContain("does-not-exist");
  });

  it("treats a source as not-yet-effective before its date", () => {
    const ku = getSource("de-ustg-19");
    expect(ku).toBeDefined();
    const check = checkSources(["de-ustg-19"], "2024-12-31");
    expect(check.notYetEffective).toContain("de-ustg-19");
    expect(check.ok).toBe(false);
  });
});
