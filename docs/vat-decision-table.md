# VAT decision table

Deterministic paths implemented in `src/domain/vat/engine.ts`, grounded in the
committed corpus (`src/corpus/*.json`). **Grounded in official sources but
requires professional sign-off before production use.**

| Decision code | Inputs | Result | Invoice treatment | Sources | Reporting | Block? |
| --- | --- | --- | --- | --- | --- | --- |
| `DE_STD_19` | DE supplier (not KU), DE business customer, supported service | approved | German VAT 19% | de-ustg-3a, 12, 14 | — | no |
| `DE_KU_19UStG` | DE supplier with `kleinunternehmer=true`, DE business | approved | No VAT; §19 exemption note | de-ustg-19, bmf-2025, 14 | — | no |
| `EU_RC_B2B` | EU business, format-valid VAT ID, general service | approved | No German VAT; reverse charge; both VAT IDs | de-ustg-3a, 13b, 14a, 18a, vies, 14 | ZM (§18a) | no |
| `NONEU_OOS` | non-EU business, general service | approved | Not taxable in DE; foreign obligations undetermined; ECB EUR metadata | de-ustg-3a, 14 (+ecb-exr if non-EUR) | — | no |
| `BLOCK_PRIVATE` | customer is private | refused | none — no number, no PDF, review case | de-ustg-3a | — | **yes** |
| `BLOCK_SCOPE` | goods / real estate / event / mixed / platform | refused | none | de-ustg-3a | — | **yes** |
| `BLOCK_UNSUPPORTED_SERVICE` | unclassifiable service | escalate | none | de-ustg-3a | — | **yes** |
| `ESCALATE_SPECIAL` | special establishment / intermediary / reduced-rate ambiguity | escalate | none | de-ustg-3a | — | **yes** |

## Clarification / fail-closed

- Unknown customer type or unconfirmed business status → `needs_clarification`.
- EU customer without a VAT ID → `needs_clarification` (`customer_vat_id`); with
  an implausible format → `needs_clarification` (`valid_customer_vat_id`); live
  VIES is never claimed.
- Any referenced corpus source missing / expired / not-yet-effective / unverified
  → `escalate` (`source_missing_or_invalid`), no invoice.

## Requires legal verification
Exact §13b/§14a reverse-charge wording, §18a ZM applicability, and confirmation
that each demo service is a §3a(2) general-rule service with no §3a(3) exception.
