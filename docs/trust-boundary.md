# Trust boundary

The model's confidence is **never** treated as tax confidence. Trust is a
deterministic state derived by the engine.

## The AI may

Intent recognition, extraction from text/images/PDF, service-description
normalization, a *suggested* category, phrasing of an already-computed decision.

## The AI must not (and cannot, by construction)

Final VAT treatment, tax rate, arithmetic, totals, currency conversion,
sequential numbers, mandatory legal wording, citation selection, escalation, or
whether an invoice may be generated.

## How it is enforced

- **Pure engine.** `src/domain/**` imports no provider SDK, React, Supabase, or
  PDF code. It accepts normalized facts and returns `DecisionResult`.
- **Schema gate.** Every AI output is parsed by a Zod schema (`src/ai/schema.ts`)
  before it can prefill anything; extraction sets only descriptive fields.
- **User confirmation.** Legal-status fields (customer type, business status,
  region) are reset for user confirmation after AI extraction — the AI never
  asserts them.
- **Server-injected profile.** `DecisionInput.profile` comes from the server
  session profile, not the client, so the client cannot spoof Kleinunternehmer
  status.
- **Fail closed.** Missing facts, unsupported categories, exception flags, or a
  missing/expired/unverified corpus source ⇒ `needs_clarification` / `escalate` /
  `refused` — never a guess and never a PDF.
- **Approval-gated side effects.** A number is allocated and a PDF rendered only
  when `status === "approved" && invoiceGenerationAllowed`.

## Decision states

`approved` · `needs_clarification` · `escalate` · `refused`. Only `approved`
permits invoice generation. `refused`/`escalate` create a Supabase/local review
case with the exact question for a tax expert.

## Tests

`tests/golden/**` (five scenarios) and `tests/unit/engine.test.ts` assert the
boundary, including that non-approved decisions never permit an invoice.
