"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface ReviewCase {
  id: string;
  reason: string;
  decisionCode: string;
  customerName: string;
  missingFacts: string[];
  escalationReasons: string[];
  expertQuestion: string;
  createdAt: string;
}

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
              <li
                key={c.id}
                ref={highlighted ? highlightRef : undefined}
                tabIndex={highlighted ? -1 : undefined}
                className={`rounded-tf-lg border bg-tf-surface p-4 outline-none transition ${
                  highlighted
                    ? `border-amber-400 ring-2 ring-amber-400/70 shadow-[0_0_0_4px_rgba(251,191,36,0.25)] ${pulse ? "animate-pulse" : ""}`
                    : "border-tf-divider"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{c.customerName}</span>
                  <span className="flex items-center gap-2">
                    {highlighted ? (
                      <span className="rounded-full bg-tf-yellow-pale px-2 py-0.5 text-[10px] font-semibold text-tf-amber">Just raised</span>
                    ) : null}
                    <span className="font-mono text-xs text-tf-gray">{c.decisionCode}</span>
                  </span>
                </div>
                <p className="mt-1 text-sm">{c.reason}</p>
                {c.missingFacts.length > 0 ? (
                  <p className="mt-2 text-xs text-tf-gray">Missing: {c.missingFacts.join(", ")}</p>
                ) : null}
                <p className="mt-2 rounded-tf bg-tf-surface-muted p-2 text-sm">
                  <span className="font-semibold">For a tax expert: </span>{c.expertQuestion}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
