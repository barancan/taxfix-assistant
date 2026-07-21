import { describe, expect, it } from "vitest";
import { KNOWLEDGE, KNOWLEDGE_VERSION } from "@/domain/knowledge";
import { getSource } from "@/domain/corpus";

describe("knowledge base governance", () => {
  it("loads a versioned, non-empty base", () => {
    expect(KNOWLEDGE_VERSION).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(KNOWLEDGE.length).toBeGreaterThanOrEqual(10);
  });

  it("every entry cites at least one source that exists in the committed corpus", () => {
    for (const e of KNOWLEDGE) {
      expect(e.sourceIds.length).toBeGreaterThan(0);
      for (const id of e.sourceIds) {
        expect(getSource(id), `entry ${e.entryId} → ${id}`).toBeDefined();
      }
    }
  });

  it("every entry is verified and has retrieval signals", () => {
    for (const e of KNOWLEDGE) {
      expect(e.verificationStatus).toBe("verified");
      expect(e.keywords.length).toBeGreaterThan(0);
      expect(e.questionExamples.length).toBeGreaterThan(0);
      expect(["explained", "general_guidance"]).toContain(e.scope);
    }
  });

  it("has unique entry ids", () => {
    const ids = KNOWLEDGE.map((e) => e.entryId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
