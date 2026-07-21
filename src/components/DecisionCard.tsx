import type { DecisionResult } from "@/domain/schemas";
import type { Citation } from "@/domain/corpus";

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-tf-green-pale text-tf-green-dark",
  needs_clarification: "bg-tf-yellow-pale text-tf-amber",
  escalate: "bg-tf-yellow-pale text-tf-amber",
  refused: "bg-red-50 text-tf-danger",
};

const STATUS_LABEL: Record<string, string> = {
  approved: "Approved",
  needs_clarification: "Needs clarification",
  escalate: "Escalated to expert",
  refused: "Blocked",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-tf-divider py-3 first:border-t-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-tf-gray">{title}</h4>
      <div className="mt-1 text-sm text-tf-ink">{children}</div>
    </div>
  );
}

export function DecisionCard({
  decision,
  citations,
}: {
  decision: DecisionResult;
  citations: Citation[];
}) {
  const treatmentText: Record<string, string> = {
    standard: `German VAT at ${decision.germanVatRate}% is charged.`,
    exempt_kleinunternehmer: "No VAT — small-business exemption (§19 UStG).",
    reverse_charge: "No German VAT — reverse charge applies in the customer's country.",
    not_taxable_de: "No German VAT — the supply is not taxable in Germany.",
    blocked: "No invoice can be issued for this case.",
  };

  return (
    <div className="rounded-tf-lg border border-tf-divider bg-tf-surface p-4">
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[decision.status]}`}>
          {STATUS_LABEL[decision.status]}
        </span>
        <span className="text-xs font-mono text-tf-gray">{decision.decisionCode}</span>
      </div>

      <Section title="Decision">{treatmentText[decision.vatTreatment] ?? decision.vatTreatment}</Section>

      {decision.missingFacts.length > 0 ? (
        <Section title="Missing facts">
          <ul className="list-disc pl-4">
            {decision.missingFacts.map((f) => (
              <li key={f}>{f.replace(/_/g, " ")}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="What goes on the invoice">
        {decision.status === "approved" ? (
          <ul className="list-disc pl-4">
            {decision.requiredInvoiceFields.map((f) => (
              <li key={f}>{f.replace(/_/g, " ")}</li>
            ))}
          </ul>
        ) : (
          "No invoice is produced for this case."
        )}
      </Section>

      {decision.reportingHints.length > 0 ? (
        <Section title="What happens next">
          <ul className="list-disc pl-4">
            {decision.reportingHints.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section title="Evidence">
        {citations.length === 0 ? (
          <span className="text-tf-gray">No sources.</span>
        ) : (
          <ul className="flex flex-col gap-2">
            {citations.map((c) => (
              <li key={c.sourceId} className="rounded-tf border border-tf-divider p-2">
                <a href={c.url} target="_blank" rel="noreferrer" className="font-medium text-tf-green-dark underline">
                  {c.title}
                </a>
                <p className="text-xs text-tf-gray">{c.section} · effective {c.effectiveDate}</p>
                <p className="mt-1 text-xs text-tf-gray">{c.excerpt}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {decision.boundaryStatements.length > 0 ? (
        <Section title="Boundary">
          <ul className="list-disc pl-4 text-tf-gray">
            {decision.boundaryStatements.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
