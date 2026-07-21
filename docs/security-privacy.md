# Security & privacy

## Secrets
- Provider keys and the Supabase service-role key are **server-only** (`src/config/env.ts`
  imports `server-only`). None are in the client bundle. `.env*` is gitignored;
  `.env.example` holds placeholders only.

## BYOK lifecycle
- The user's key lives in React state (memory) only. It is sent per-request to
  `/api/extract`, used to build a request-scoped provider, and discarded.
- It is **never** written to localStorage, sessionStorage, cookies, the URL,
  Supabase, logs, errors, or analytics. A page refresh clears it (re-entry
  required). Verified at runtime: a bad BYOK key returns a normalized
  `invalid_credentials` with **no key echoed** in the response.

## Uploads
- Processed server-side, held in memory, discarded after extraction. Never
  written to disk or Supabase. Type is validated by **magic bytes** (`file-type`),
  not the filename; only PNG/JPEG/WebP/PDF, ≤ 8 MB, ≤ 4 files.
- The UI discloses that content is sent to the selected AI provider for
  extraction and is not stored by the POC.

## Prompt-injection resistance
- Document/text content is framed as **data, not instructions**; the system
  prompt tells the model to ignore embedded instructions.
- Extraction calls expose no tools beyond the single structured-output tool;
  every value is Zod-validated; document text can never alter tax logic.

## Sessions & PDF
- Opaque HMAC-signed (Web Crypto) HTTP-only, `secure`, `sameSite=lax` cookie set
  by `src/proxy.ts`. The server stores only the id. No cross-session access.
- PDFs are deterministic, escape user content, and live in a private bucket.

## Agent trace (dev observability)
- `AGENT_TRACE` prints human-readable skill/model activity to the server
  terminal (queries and response summaries, truncated). It is **on in
  development, off in production** unless explicitly enabled. It never logs API
  keys, Authorization headers, BYOK credentials, or uploaded file bytes (files
  appear as mime+size only).

## Error taxonomy & logging
- Raw provider error bodies are normalized (`src/ai/errors.ts`) into safe kinds;
  raw bodies/keys/headers are never surfaced. Structured logging is kept minimal
  and must never include keys, full prompts, uploads, full tax IDs, or bank
  details.

## Known POC limitations
Single synthetic tenant, no auth, mocked VIES, non-durable local fallback — see
[limitations.md](./limitations.md).
