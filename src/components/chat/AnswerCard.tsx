import Link from "next/link";
import type { Citation } from "@/domain/corpus";
import { CitationList } from "@/components/CitationList";

/** A general-question answer shown in the transcript, with corpus citations. */
export function AnswerCard({ text, citations }: { text: string; citations: Citation[] }) {
  return (
    <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-tf-divider bg-tf-surface px-3.5 py-2.5">
      <p className="whitespace-pre-wrap text-sm text-tf-ink">{text}</p>
      {citations.length > 0 ? (
        <details className="mt-2 border-t border-tf-divider pt-2">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-tf-gray">
            Sources ({citations.length})
          </summary>
          <div className="mt-2">
            <CitationList citations={citations} />
          </div>
        </details>
      ) : null}
      <p className="mt-2 text-[10px] text-tf-gray">
        General information, not tax advice for your specific case.
      </p>
    </div>
  );
}

/** Shown when confidence fell below the threshold and the subject was raised to a human. */
export function EscalatedAnswerCard({ reviewCaseId }: { reviewCaseId: string | null }) {
  return (
    <div className="rounded-tf-lg border border-amber-300/70 bg-tf-yellow-pale p-4 text-sm">
      <p className="font-semibold text-tf-amber">This one deserves a human 🤝</p>
      <p className="mt-1 text-tf-ink">
        I&rsquo;m not confident enough to answer that reliably, so I&rsquo;ve raised it for a
        Taxfix tax expert instead of guessing.
      </p>
      {reviewCaseId ? (
        <Link
          href="/review"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-tf-green-strong px-5 py-2.5 text-sm font-semibold text-white shadow-sm active:scale-95"
        >
          View the expert request →
        </Link>
      ) : null}
    </div>
  );
}
