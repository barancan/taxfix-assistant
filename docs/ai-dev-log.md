# AI-assisted development log

This POC was built with Claude Code (Opus 4.8) under an approved plan. Summary of
what the AI proposed, what was accepted, edited, or rejected, and why.

## Accepted
- **Pure `src/domain` core** with a data-driven rule table and fail-closed corpus
  governance — the backbone of the trust boundary.
- **decimal.js + integer minor units** for all money math (no JS floats).
- **@react-pdf/renderer** for deterministic PDFs (no headless browser on Vercel).
- **Provider abstraction** with Anthropic (forced tool) + OpenAI (Responses API
  strict `json_schema`), and a normalized error taxonomy.
- **Web-Crypto HMAC session cookie** via `proxy.ts` — no extra dependency.
- **Storage adapter** with a local in-memory fallback so the demo runs without
  Supabase.

## Edited
- Package pins: several "latest" versions were < 10 days old at install; the AI
  resolved older eligible versions and added `overrides` until the age audit
  passed on the whole tree.
- ESLint: switched from FlatCompat (circular-plugin crash) to eslint-config-next's
  **native flat config**.
- `middleware.ts` → `proxy.ts` per Next 16's convention; split cookie reading into
  `session-server.ts` so edge code never imports `next/headers`.
- TypeScript pinned to **5.9.3** (not the new native 7.0) for toolchain stability.

## Rejected
- LangChain / agent frameworks, a vector DB, and headless-browser PDF — all
  unnecessary for a small committed corpus and a controlled template.
- Letting the LLM decide tax treatment, compute totals, choose citations, or
  produce mandatory legal wording — all deterministic by construction.
- Silent provider fallback — kept behind an explicit, default-off flag.

## Verification
Golden + unit + integration tests (45), a package-age audit, typecheck, lint, and
a production build gate each milestone. End-to-end runtime was exercised: US
invoice PDF with live-ECB EUR metadata, private-customer hard block → review case,
and BYOK error normalization with no key leakage.
