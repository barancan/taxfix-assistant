"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    fetch("/api/review-cases")
      .then((r) => r.json())
      .then((d) => setCases(d.reviewCases ?? []))
      .finally(() => setLoading(false));
  }, []);

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
          {cases.map((c) => (
            <li key={c.id} className="rounded-tf-lg border border-tf-divider bg-tf-surface p-4">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{c.customerName}</span>
                <span className="font-mono text-xs text-tf-gray">{c.decisionCode}</span>
              </div>
              <p className="mt-1 text-sm">{c.reason}</p>
              {c.missingFacts.length > 0 ? (
                <p className="mt-2 text-xs text-tf-gray">Missing: {c.missingFacts.join(", ")}</p>
              ) : null}
              <p className="mt-2 rounded-tf bg-tf-surface-muted p-2 text-sm">
                <span className="font-semibold">For a tax expert: </span>{c.expertQuestion}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
