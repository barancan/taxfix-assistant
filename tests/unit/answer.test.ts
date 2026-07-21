import { describe, expect, it } from "vitest";
import { answerSystemPrompt, passesThreshold, sanitizeAnswer } from "@/ai/answer";

describe("structured answer sanitization & gate", () => {
  it("keeps only source ids that exist in the committed corpus", () => {
    const a = sanitizeAnswer({
      kind: "question",
      answer: "Reverse charge shifts VAT liability to the recipient.",
      confidence: 0.8,
      relatedSourceIds: ["de-ustg-13b", "made-up-source", "de-ustg-14a"],
    });
    expect(a).not.toBeNull();
    expect(a!.relatedSourceIds).toEqual(["de-ustg-13b", "de-ustg-14a"]);
  });

  it("clamps confidence into [0,1]", () => {
    expect(sanitizeAnswer({ kind: "question", answer: "x", confidence: 1.7, relatedSourceIds: [] })!.confidence).toBe(1);
    expect(sanitizeAnswer({ kind: "question", answer: "x", confidence: -0.2, relatedSourceIds: [] })!.confidence).toBe(0);
  });

  it("rejects malformed payloads", () => {
    expect(sanitizeAnswer({ kind: "nope", answer: "x", confidence: 0.5, relatedSourceIds: [] })).toBeNull();
    expect(sanitizeAnswer({ kind: "question", confidence: 0.5, relatedSourceIds: [] })).toBeNull();
    expect(sanitizeAnswer(null)).toBeNull();
  });

  it("threshold gate: display only at/above threshold", () => {
    expect(passesThreshold(0.65, 0.65)).toBe(true);
    expect(passesThreshold(0.649, 0.65)).toBe(false);
    expect(passesThreshold(0.9, 0.65)).toBe(true);
  });

  it("system prompt embeds the retrieved grounding and citation/confidence rules", () => {
    const grounding = "- Kleinunternehmer scheme (cite: de-ustg-19)\n  Small business exemption…";
    const p = answerSystemPrompt(grounding);
    expect(p).toContain("de-ustg-19");
    expect(p).toContain("answer ONLY from this material");
    expect(p).toContain("NEVER invent a source");
    expect(p).toContain("confidence");
  });

  it("system prompt defers when no grounding was retrieved", () => {
    const p = answerSystemPrompt("");
    expect(p).toContain("No official grounding was retrieved");
    expect(p).toContain("confidence below 0.4");
  });
});
