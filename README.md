# Taxfix AI Tax Assistant — Proof of Concept

> **Prototype / Demo only.** This app produces *synthetic* invoices for demonstration.
> It is **not** genuine tax advice and must not be used for real filings.

A mobile-first Next.js app with an embedded AI assistant that helps a non-German
expat freelancer in Germany **issue a compliant outgoing B2B service invoice** —
and answer everyday freelancer tax questions — without understanding German VAT
terminology.

It's a **hybrid** system: the LLM handles language, extraction, and phrasing; a
**deterministic engine** owns every legally material decision (VAT treatment,
arithmetic, mandatory wording, invoice numbering, blocking, escalation). The
model's confidence is never treated as tax confidence.

---

## How the demo works

The **Assistant** is a chat interface with two capabilities ("skills" — see
[docs/skills.md](docs/skills.md)):

### 1. Create an invoice
1. **Say what you need** — e.g. *"invoice my business client Molecule in Switzerland
   for 12,000 EUR for software dev consulting"*, or tap a coloured **example prompt**
   (🟢 supported · 🟡 escalates · 🔴 blocked).
2. **Extraction** — the AI pulls the customer, country, currency, service and line
   items from your message (or a **📷 scanned** business card / invoice / PDF). Every
   field is shown for **confirmation** — the AI never commits legally material facts.
3. **Structured collection** — a sticky "Collected so far" header fills in as you
   confirm the company, the **business-status confirmation** (required for the VAT
   decision), and line items.
4. **Deterministic decision** — the VAT engine returns one of: German VAT 19%,
   Kleinunternehmer exemption, EU reverse charge, non-EU "not taxable in Germany",
   or a **hard block / escalation** — each with **plain-English English citations**
   linking to the official German source (toggle to view the original Deutsch).
5. **Invoice** — on approval it allocates a sequential number, computes totals
   (decimal-safe), fetches the ECB EUR reference rate for foreign currencies, and
   renders a **branded PDF** shown inline (click to open in a new tab). Blocked /
   escalated cases create a **review case** instead — no number, no PDF.
6. **Continue to chat** — after a decision you can collapse the flow and keep
   chatting, or start a new invoice.

### 2. Ask a general question
Ask things like *"what can I do as a Kleinunternehmer?"*, *"tax number vs VAT ID?"*,
or *"when is my 2025 return due?"*. Answers are **retrieval-grounded**: a curated,
citation-backed knowledge base is searched, the model answers **only** from the
retrieved official-source material, and the answer is shown only if it's grounded
**and** confident enough. Otherwise the question is **raised to a human** (a review
case). Personal, case-specific questions always escalate.

### Watch it think
Run with `AGENT_TRACE=true` (default in dev) and the terminal logs each step in
plain language — skill calls, model queries, the raw extracted object, retrieval
scores, and the VAT decision:

```
[agent] ▶ invoice · extract — asking anthropic/claude-sonnet-5: "invoice Molecule in Switzerland…"
[agent] · invoice · extract — extracted object: {"customerName":"Molecule","customerCountryCode":"CH",…}
[agent] ▶ invoice · vat-engine — evaluating: business customer in CH (NON_EU), service=software_development
[agent] ◀ invoice · vat-engine — NONEU_OOS approved: not_taxable_de (2 sources)
[agent] ◀ chat · answer — retrieved [kleinunternehmer(0.72),…] grounded=yes confidence=0.75 ≥ 0.65 → answering
```

---

## Quick start

Requires **Node 22** (`.nvmrc` pins it; matches Vercel and `@supabase/supabase-js`).

```bash
nvm use            # or: nvm install 22
npm install
cp .env.example .env.local   # add provider keys; Supabase optional
npm run dev
```

- **Without Supabase env** → runs in **local demo persistence** (`.local-store/`,
  gitignored); a banner shows the mode. Invoices/PDFs survive dev restarts.
- **Without an AI key** → the invoice flow still works via the manual form, and a
  **BYOK** panel lets you paste your own key (held in browser memory only).

---

## Architecture at a glance

- **Trust boundary** — `src/domain/**` is pure (no React, provider SDK, Supabase, or
  PDF). It owns the VAT decision, money math, wording, numbering, and blocking.
  The AI only extracts/phrases; its output crosses into the engine **only** through
  Zod schemas + user confirmation. See [docs/trust-boundary.md](docs/trust-boundary.md).
- **Skills** — the assistant is a generic chat host; capabilities are skills under
  `src/skills/` (invoice today). Add one = a folder + a registry line.
- **Knowledge base** — `src/knowledge/entries.json`, each entry citing official
  corpus sources; lexical retrieval (no vector DB) grounds general answers.
- **Official corpus** — `src/corpus/*.json`, 16 verified sources (UStG, AO, BMF,
  BZSt, ELSTER, ECB); the engine fails closed on a missing/expired source.

```
Browser (chat UI)  →  route handlers  →  AI adapters (Anthropic / OpenAI)   [advisory]
                                     →  deterministic domain core           [authoritative]
                                     →  ECB adapter · PDF renderer · storage (Supabase | local)
```

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev / production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm run test` | Unit + integration (67 tests) |
| `npm run test:golden` | Golden VAT decision scenarios |
| `npm run check:corpus` | Validate the official source corpus |
| `npm run check:knowledge` | Validate the knowledge base (sources must resolve) |
| `npm run audit:package-age` | Fail if any resolved dep is < 10 days old |

---

## Environment

Full reference in [.env.example](.env.example). Key variables:

| Variable | Purpose |
| --- | --- |
| `AI_DEFAULT_PROVIDER`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `*_MODEL` | Server-funded AI (server-only) |
| `AI_ALLOW_BYOK` | Allow bring-your-own-key from the UI |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Enable Supabase persistence (else local fallback) |
| `SESSION_SECRET` | HMAC secret for the signed session cookie |
| `DEMO_MODE` | Prototype markers on invoices/UI (default on) |
| `AGENT_TRACE` | Human-readable agent trace in the terminal (dev default on) |
| `ANSWER_CONFIDENCE_THRESHOLD` | General answers below this model confidence escalate (default 0.6) |
| `KNOWLEDGE_RELEVANCE_MIN` | Min retrieval relevance to answer from sources (default 0.3) |

---

## Documentation

- [Architecture](docs/architecture.md) · [Trust boundary](docs/trust-boundary.md) · [Skills](docs/skills.md)
- [VAT decision table](docs/vat-decision-table.md) · corpus in `src/corpus/`, knowledge in `src/knowledge/`
- [Supabase setup](docs/supabase-setup.md) · migrations in `supabase/migrations/`
- [Security & privacy](docs/security-privacy.md) · [Dependency-age policy](docs/dependency-audit.md)
- [Limitations](docs/limitations.md) · [AI-assisted dev log](docs/ai-dev-log.md)

## Engineering constraints

- No dependency version released within the previous 10 days (audited, fail-closed).
- Deterministic domain core imports no React, provider SDK, Supabase, or PDF code.
- Server-only secrets; BYOK keys held in browser memory only; official-source
  citations never invented.
