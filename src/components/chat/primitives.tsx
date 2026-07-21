"use client";

import { useRef } from "react";
import { PRESETS, type Preset } from "@/lib/presets";
import { collectedSubtotal, type Collected } from "@/lib/facts";

export function Bubble({ role, children }: { role: "assistant" | "user"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${
          isUser
            ? "rounded-br-sm bg-tf-green-strong text-white"
            : "rounded-bl-sm border border-tf-divider bg-tf-surface text-tf-ink"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function TypingBubble() {
  return (
    <div className="flex justify-start" aria-live="polite">
      <div className="rounded-2xl rounded-bl-sm border border-tf-divider bg-tf-surface px-3.5 py-3">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-tf-gray-soft" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </span>
      </div>
    </div>
  );
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onAttach,
  placeholder,
  disabled,
  showAttach,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttach: (file: File) => void;
  placeholder: string;
  disabled?: boolean;
  showAttach?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-end gap-2">
      {showAttach ? (
        <>
          <button
            type="button"
            aria-label="Scan a document with the camera"
            onClick={() => fileRef.current?.click()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-tf-divider bg-tf-surface text-lg"
          >
            📷
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onAttach(f);
              e.target.value = "";
            }}
          />
        </>
      ) : null}
      <textarea
        rows={1}
        className="max-h-28 flex-1 resize-none rounded-2xl border border-tf-divider bg-tf-surface px-3.5 py-2.5 text-sm focus:outline-none"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (value.trim() && !disabled) onSend();
          }
        }}
      />
      <button
        type="button"
        aria-label="Send"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tf-green-strong text-lg text-white disabled:opacity-40"
      >
        ↑
      </button>
    </div>
  );
}

function Chip({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="rounded-full border border-tf-divider bg-tf-surface px-2.5 py-1 text-xs font-medium text-tf-ink enabled:active:scale-95"
    >
      {label}
    </button>
  );
}

export function CollectedHeader({
  collected,
  onEdit,
}: {
  collected: Collected;
  onEdit: (section: "company" | "legal" | "lineitems") => void;
}) {
  const hasCustomer = collected.customerName.length > 0;
  const hasLines = collected.lines.length > 0;
  if (!hasCustomer && !hasLines) return null;

  const total = collectedSubtotal(collected);
  const totalStr = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(total);

  return (
    <div className="border-b border-tf-divider bg-tf-surface-muted px-1 py-2">
      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-tf-gray">Collected so far</p>
      <div className="flex flex-wrap gap-1.5">
        {hasCustomer ? (
          <Chip
            label={`👤 ${collected.customerName} · ${collected.countryCode}${collected.vatId ? " · " + collected.vatId : ""}`}
            onClick={() => onEdit("company")}
          />
        ) : null}
        {collected.customerType !== "unknown" ? (
          <Chip label={`🏷 ${collected.customerType}`} onClick={() => onEdit("legal")} />
        ) : null}
        {hasLines ? (
          <Chip label={`🧾 ${collected.lines.length} item(s) · ${totalStr} ${collected.currency}`} onClick={() => onEdit("lineitems")} />
        ) : null}
      </div>
    </div>
  );
}

/** Pill styling by expected outcome: green = success, yellow = escalation, red = denied. */
const OUTCOME_PILL: Record<Preset["outcome"], string> = {
  success: "border-tf-green/40 bg-tf-green-pale text-tf-green-dark",
  escalate: "border-amber-300/70 bg-tf-yellow-pale text-tf-amber",
  blocked: "border-red-200 bg-red-50 text-tf-danger",
};

export function RecommendedPrompts({ onPick }: { onPick: (p: Preset) => void }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onPick(p)}
          title={p.sentence}
          className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium active:scale-95 ${OUTCOME_PILL[p.outcome]}`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
