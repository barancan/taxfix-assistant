import { z } from "zod";
import { getSource } from "../corpus";
import raw from "../../knowledge/entries.json";

/**
 * Curated, citation-backed knowledge base for broader freelancer questions.
 * Committed and versioned like the corpus; every entry cites official corpus
 * sources. Validated at module load — fails closed on a bad shape or an entry
 * that references a source not in the corpus.
 */
export const KnowledgeEntrySchema = z.object({
  entryId: z.string().min(1),
  topic: z.string().min(1),
  titleEn: z.string().min(1),
  keywords: z.array(z.string().min(1)).min(1),
  questionExamples: z.array(z.string().min(1)).min(1),
  answerEn: z.string().min(1),
  answerDe: z.string().optional(),
  sourceIds: z.array(z.string().min(1)).min(1),
  scope: z.enum(["explained", "general_guidance"]),
  verificationStatus: z.enum(["verified", "unverified", "draft"]),
});
export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>;

const FileSchema = z.object({
  version: z.string().min(1),
  entries: z.array(KnowledgeEntrySchema).min(1),
});

const parsed = FileSchema.parse(raw);
export const KNOWLEDGE_VERSION = parsed.version;
export const KNOWLEDGE: KnowledgeEntry[] = parsed.entries;

const BY_ID = new Map(KNOWLEDGE.map((e) => [e.entryId, e]));
if (BY_ID.size !== KNOWLEDGE.length) throw new Error("Knowledge base has duplicate entryIds");

// Fail closed: every referenced source must exist in the committed corpus.
for (const e of KNOWLEDGE) {
  for (const id of e.sourceIds) {
    if (!getSource(id)) {
      throw new Error(`Knowledge entry "${e.entryId}" references unknown source "${id}"`);
    }
  }
}

export function getEntry(id: string): KnowledgeEntry | undefined {
  return BY_ID.get(id);
}
