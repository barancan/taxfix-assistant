import { z } from "zod";
import { isoDate } from "../schemas";

import ustg3a from "../../corpus/de-ustg-3a.json";
import ustg12 from "../../corpus/de-ustg-12.json";
import ustg13b from "../../corpus/de-ustg-13b.json";
import ustg14 from "../../corpus/de-ustg-14.json";
import ustg14a from "../../corpus/de-ustg-14a.json";
import ustg18a from "../../corpus/de-ustg-18a.json";
import ustg19 from "../../corpus/de-ustg-19.json";
import bmfKu from "../../corpus/de-bmf-kleinunternehmer-2025.json";
import vies from "../../corpus/eu-vies.json";
import ecb from "../../corpus/ecb-exr.json";
import ustg18 from "../../corpus/de-ustg-18.json";
import ao138 from "../../corpus/de-ao-138.json";
import ao139a from "../../corpus/de-ao-139a.json";
import bzstUstIdNr from "../../corpus/de-bzst-ustidnr.json";
import elster from "../../corpus/de-elster.json";

/** Committed, versioned official source corpus. Bump on any change. */
export const CORPUS_VERSION = "2026-07-21.3";

export const CorpusSourceSchema = z.object({
  sourceId: z.string().min(1),
  jurisdiction: z.enum(["DE", "EU"]),
  officialTitle: z.string().min(1),
  // Controlled English translation of the title (committed, not LLM-generated).
  officialTitleEn: z.string().min(1),
  issuingAuthority: z.string().min(1),
  legalSection: z.string().min(1),
  topic: z.string().min(1),
  excerpt: z.string().min(1),
  // Controlled English translation of the excerpt. The original `excerpt` (and
  // `url`) remain the authoritative source; this is for display only.
  excerptEn: z.string().min(1),
  url: z.string().url(),
  effectiveDate: isoDate,
  retrievedDate: isoDate,
  supersededDate: isoDate.nullable(),
  supportedRuleIds: z.array(z.string().min(1)).min(1),
  language: z.enum(["de", "en"]),
  verificationStatus: z.enum(["verified", "unverified", "draft"]),
});
export type CorpusSource = z.infer<typeof CorpusSourceSchema>;

const RAW: unknown[] = [
  ustg3a,
  ustg12,
  ustg13b,
  ustg14,
  ustg14a,
  ustg18a,
  ustg19,
  bmfKu,
  vies,
  ecb,
  ustg18,
  ao138,
  ao139a,
  bzstUstIdNr,
  elster,
];

/** Parse + validate at module load. Throws if a source is structurally invalid. */
export const CORPUS: CorpusSource[] = RAW.map((r) => CorpusSourceSchema.parse(r));

const BY_ID = new Map(CORPUS.map((s) => [s.sourceId, s]));

/** Detect duplicate source ids (fail closed at load). */
if (BY_ID.size !== CORPUS.length) {
  throw new Error("Corpus contains duplicate sourceIds");
}

export function getSource(id: string): CorpusSource | undefined {
  return BY_ID.get(id);
}

export interface Citation {
  sourceId: string;
  /** Authoritative (original) title, usually German. */
  title: string;
  /** Controlled English translation of the title (shown by default in EN UI). */
  titleEn: string;
  issuer: string;
  section: string;
  /** Authoritative (original) excerpt, usually German. */
  excerpt: string;
  /** Controlled English translation of the excerpt (shown by default). */
  excerptEn: string;
  /** Language of the original excerpt ("de" | "en") — drives the toggle. */
  language: "de" | "en";
  effectiveDate: string;
  retrievedDate: string;
  url: string;
}

/** Build UI citations for a set of source ids (unknown ids are skipped). */
export function getCitations(sourceIds: string[]): Citation[] {
  const out: Citation[] = [];
  for (const id of sourceIds) {
    const s = BY_ID.get(id);
    if (!s) continue;
    out.push({
      sourceId: s.sourceId,
      title: s.officialTitle,
      titleEn: s.officialTitleEn,
      issuer: s.issuingAuthority,
      section: s.legalSection,
      excerpt: s.excerpt,
      excerptEn: s.excerptEn,
      language: s.language,
      effectiveDate: s.effectiveDate,
      retrievedDate: s.retrievedDate,
      url: s.url,
    });
  }
  return out;
}

export interface SourceCheck {
  ok: boolean;
  missing: string[];
  unverified: string[];
  expired: string[];
  notYetEffective: string[];
}

/**
 * Verify that every referenced source exists, is verified, effective, and not
 * superseded as of `asOf`. The engine calls this and FAILS CLOSED on any issue.
 */
export function checkSources(sourceIds: string[], asOf: string): SourceCheck {
  const missing: string[] = [];
  const unverified: string[] = [];
  const expired: string[] = [];
  const notYetEffective: string[] = [];

  for (const id of sourceIds) {
    const s = BY_ID.get(id);
    if (!s) {
      missing.push(id);
      continue;
    }
    if (s.verificationStatus !== "verified") unverified.push(id);
    if (asOf < s.effectiveDate) notYetEffective.push(id);
    if (s.supersededDate && asOf >= s.supersededDate) expired.push(id);
  }

  return {
    ok:
      missing.length === 0 &&
      unverified.length === 0 &&
      expired.length === 0 &&
      notYetEffective.length === 0,
    missing,
    unverified,
    expired,
    notYetEffective,
  };
}
