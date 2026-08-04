import { describe, expect, it } from "vitest";
import { normalizeAddressLines } from "@/skills/invoice/facts";

/**
 * The address textarea is controlled: its value is addressLines.join("\n") and
 * every keystroke splits it back apart. Normalizing inside that round trip made
 * the field reject the space bar — the trim removed the space the moment it was
 * typed at the end of a line. Normalization belongs on confirm instead.
 */
describe("address line normalization", () => {
  it("survives the controlled round trip mid-typing, keeping the trailing space", () => {
    // What the field holds while the user is partway through "Lisboa Portugal".
    const typed = "Av. da Liberdade 100\n1250-096 Lisboa ";
    const roundTripped = typed.split("\n").join("\n");
    expect(roundTripped).toBe(typed);
    expect(roundTripped.endsWith(" ")).toBe(true);
  });

  it("keeps interior spaces and blank lines while editing", () => {
    const typed = "Av. da Liberdade 100\n\n1250-096 Lisboa";
    expect(typed.split("\n")).toEqual(["Av. da Liberdade 100", "", "1250-096 Lisboa"]);
  });

  it("trims and drops blank lines when the field is committed", () => {
    expect(
      normalizeAddressLines(["  Av. da Liberdade 100 ", "", "1250-096 Lisboa ", "   "]),
    ).toEqual(["Av. da Liberdade 100", "1250-096 Lisboa"]);
  });

  it("never collapses spaces between words", () => {
    expect(normalizeAddressLines([" Exemplo Unipessoal Lda "])).toEqual(["Exemplo Unipessoal Lda"]);
  });

  it("is a no-op on already-clean input", () => {
    const clean = ["Av. da Liberdade 100", "1250-096 Lisboa", "Portugal"];
    expect(normalizeAddressLines(clean)).toEqual(clean);
  });
});
