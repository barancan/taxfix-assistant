# Known limitations

This is a **prototype**. It produces synthetic demonstration documents, not
genuine tax advice.

- **Legal scope is narrow and explicit.** Only outgoing B2B ordinary
  professional services on the five supported paths. Everything else is blocked
  or escalated. Treatments require professional sign-off (see
  [vat-decision-table.md](./vat-decision-table.md)).
- **Single synthetic tenant, no auth.** One seeded profile; sessions are opaque
  cookie ids. No multi-tenancy.
- **Mocked VIES.** Only the seeded Portugal scenario shows "Demo verification".
  Arbitrary VAT IDs get format validation only — no live VIES claim.
- **Local fallback is non-durable.** Without Supabase env, invoices/history live
  in server memory and reset on restart. Clearly labelled in the UI.
- **e-invoicing.** "Structured invoice ready" is a mock status; no valid
  XRechnung/ZUGFeRD artefact is produced.
- **Foreign-currency VAT.** VAT-bearing foreign-currency invoices are out of
  scope; the US scenario carries no German VAT, so it avoids that edge. ECB EUR
  values are accounting metadata only.
- **AI variability.** Extraction quality varies by provider/model; every field is
  user-confirmed and re-validated before it can affect a decision.
- **Numbering.** Concurrency-safe within the single demo account (Postgres RPC /
  in-process counter). Not a real tenant numbering model.
- **Node 22 required.** The project targets Node 22 (`.nvmrc`, `engines`),
  matching Vercel and `@supabase/supabase-js`. Use `nvm use` before installing.
