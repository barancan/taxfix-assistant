import type { Citation } from "@/domain/corpus";

/**
 * Shared citation rendering: English translation first, original (German) text
 * behind a toggle, title always linking to the official source. Used by the
 * decision card's Evidence section and by general-question answers.
 */
export function CitationList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return <span className="text-tf-gray">No sources.</span>;
  return (
    <ul className="flex flex-col gap-2">
      {citations.map((c) => (
        <li key={c.sourceId} className="rounded-tf border border-tf-divider p-2">
          <a href={c.url} target="_blank" rel="noreferrer" className="font-medium text-tf-green-dark underline">
            {c.titleEn}
          </a>
          <p className="text-xs text-tf-gray">{c.section} · effective {c.effectiveDate}</p>
          <p className="mt-1 text-xs text-tf-gray">{c.excerptEn}</p>
          {c.language === "de" ? (
            <details className="mt-1.5">
              <summary className="cursor-pointer text-xs font-medium text-tf-green-dark">
                View original (Deutsch)
              </summary>
              <p className="mt-1 text-xs font-medium text-tf-gray">{c.title}</p>
              <p className="text-xs text-tf-gray">{c.excerpt}</p>
              <a href={c.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-tf-green-dark underline">
                Open official source ↗
              </a>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
