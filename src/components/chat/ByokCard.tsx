"use client";

import { MODEL_ALLOWLIST } from "@/ai/models";
import type { ProviderName } from "@/ai/provider";
import type { ByokCredentials } from "@/skills/types";

const input = "w-full rounded-tf border border-tf-divider px-3 py-2 text-sm";

/** Host-level BYOK recovery card — shared by every skill and the free chat. */
export function ByokCard({
  byok,
  onChange,
  onRetry,
  message,
  busy,
}: {
  byok: ByokCredentials;
  onChange: (b: ByokCredentials) => void;
  onRetry: () => void;
  message: string;
  busy?: boolean;
}) {
  return (
    <div className="rounded-tf-lg border border-tf-divider bg-tf-surface p-4">
      <h3 className="text-sm font-bold">Use your own API key</h3>
      <p className="mt-1 text-xs text-tf-amber">{message}</p>
      <p className="mt-1 text-xs text-tf-gray">
        Held in memory for this request only — never stored, logged, or kept after a refresh.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <select
          className={input}
          value={byok.provider}
          onChange={(e) => {
            const provider = e.target.value as ProviderName;
            onChange({ ...byok, provider, model: MODEL_ALLOWLIST[provider][0]!.id });
          }}
        >
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
        </select>
        <select className={input} value={byok.model} onChange={(e) => onChange({ ...byok, model: e.target.value })}>
          {MODEL_ALLOWLIST[byok.provider].map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <input
          type="password"
          autoComplete="off"
          className={`${input} col-span-2`}
          placeholder="API key (kept in memory only)"
          value={byok.apiKey}
          onChange={(e) => onChange({ ...byok, apiKey: e.target.value })}
        />
      </div>
      <button
        onClick={onRetry}
        disabled={busy || !byok.apiKey}
        className="mt-3 rounded-full bg-tf-green-strong px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Retrying…" : "Retry with my key"}
      </button>
    </div>
  );
}
