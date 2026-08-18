"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ReviewCaseCard, type ReviewCase } from "@/components/ReviewCaseCard";

export default function ReviewPage() {
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [pulse, setPulse] = useState(true);
  const highlightRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    // Read the linked ticket id (from ?case=…) client-side — no Suspense needed.
    const id = new URLSearchParams(window.location.search).get("case");
    fetch("/api/review-cases")
      .then((r) => r.json())
      .then((d) => {
        setCases(d.reviewCases ?? []);
        setHighlightId(id);
      })
      .finally(() => setLoading(false));
  }, []);

  // Once the linked ticket is rendered, focus + scroll to it, then fade the pulse.
  useEffect(() => {
    if (!highlightId || !highlightRef.current) return;
    highlightRef.current.focus();
    highlightRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    const t = setTimeout(() => setPulse(false), 2600);
    return () => clearTimeout(t);
  }, [highlightId, cases]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Review cases</h1>
      <p className="text-sm text-tf-gray">
        Cases the assistant could not decide safely. No invoice, number, or PDF is created for these.
      </p>
      {loading ? (
        <p className="text-sm text-tf-gray">Loading…</p>
      ) : cases.length === 0 ? (
        <p className="text-sm text-tf-gray">No review cases. <Link href="/assistant" className="text-tf-green-dark underline">Back to assistant.</Link></p>
      ) : (
        <ul className="flex flex-col gap-3">
          {cases.map((c) => {
            const highlighted = c.id === highlightId;
            return (
              <ReviewCaseCard
                key={c.id}
                ref={highlighted ? highlightRef : undefined}
                reviewCase={c}
                highlighted={highlighted}
                pulse={pulse}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
