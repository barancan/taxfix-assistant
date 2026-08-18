"use client";

import { forwardRef } from "react";

/**
 * A review case as the client sees it. Mirrors `StoredReviewCase`
 * (src/server/storage/types.ts) minus `sessionId`, which stays server-side.
 */
export interface ReviewCase {
  id: string;
  reason: string;
  decisionCode: string;
  customerName: string;
  missingFacts: string[];
  escalationReasons: string[];
  expertQuestion: string;
  createdAt: string;
}

interface Props {
  reviewCase: ReviewCase;
  /** Deep-linked from `?case=…` — draws the amber ring and the "Just raised" badge. */
  highlighted?: boolean;
  /** Fades out shortly after the highlight lands; ignored unless `highlighted`. */
  pulse?: boolean;
}

/**
 * One review-case card. Shared by the full `/review` list and the Account
 * summary. Forwards a ref because `/review` focuses and scrolls the deep-linked
 * card once it renders.
 */
export const ReviewCaseCard = forwardRef<HTMLLIElement, Props>(function ReviewCaseCard(
  { reviewCase: c, highlighted = false, pulse = false },
  ref,
) {
  return (
    <li
      ref={ref}
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
});
