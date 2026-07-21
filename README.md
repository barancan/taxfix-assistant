# Taxfix AI Tax Assistant — Proof of Concept

> **Prototype / Demo only.** This app produces *synthetic* invoices for demonstration.
> It is **not** genuine tax advice and must not be used for real filings.

A mobile-first Next.js app that helps an expat solo freelancer in Germany issue a
compliant **outgoing B2B service invoice** without understanding German VAT
terminology. An LLM handles language and extraction; a **deterministic engine**
owns every legally material decision (VAT treatment, arithmetic, wording,
numbering, blocking, escalation). The model's confidence is never treated as tax
confidence.

## Status

Under active implementation. See the approved plan and `docs/` for architecture,
the trust boundary, the VAT decision table, the official source corpus, and the
dependency-age policy.

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in provider keys; Supabase optional
npm run dev
```

Runs in **local demo persistence** mode when Supabase env vars are absent.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev / production build / serve |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint (next config) |
| `npm run test` | Unit + integration (vitest) |
| `npm run test:golden` | Golden VAT decision scenarios |
| `npm run check:corpus` | Validate the official source corpus |
| `npm run audit:package-age` | Fail if any resolved dep is < 10 days old |

## Demo scenarios

Open **Assistant** and tap a preset (or describe an invoice and tap **Extract with AI**):

1. **US client · USD 12,000** → not taxable in Germany; USD invoice with live-ECB EUR accounting metadata.
2. **Portugal B2B** → reverse charge, both VAT IDs, ZM reporting hint (mocked "Demo verification" VIES).
3. **German B2B** → 19% German VAT.
4. **German Kleinunternehmer** (toggle in Account) → §19 exemption, no VAT.
5. **Private customer** → hard block: no number, no PDF, a **review case** instead.

Without provider keys, **Extract with AI** surfaces a BYOK recovery panel (key held
in memory only). The manual form always works with no AI.

## Documentation

- [Architecture](docs/architecture.md) · [Trust boundary](docs/trust-boundary.md)
- [VAT decision table](docs/vat-decision-table.md) · corpus in `src/corpus/`
- [Supabase setup](docs/supabase-setup.md) · migrations in `supabase/migrations/`
- [Security & privacy](docs/security-privacy.md) · [Dependency-age policy](docs/dependency-audit.md)
- [Limitations](docs/limitations.md) · [AI-assisted dev log](docs/ai-dev-log.md)

## Engineering constraints

- No dependency version released within the previous 10 days (audited, fail-closed).
- Deterministic domain core (`src/domain/**`) imports no React, provider SDK,
  Supabase, or PDF code.
- Server-only secrets; BYOK keys held in browser memory only.
