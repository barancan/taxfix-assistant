import Link from "next/link";

const VALUE_PROPS = [
  {
    icon: "✅",
    headline: "Know the right VAT treatment before you send.",
    subtext: "Standard, reverse charge, or small-business rule, worked out for your exact transaction.",
  },
  {
    icon: "📖",
    headline: "See the actual German rule, in plain English.",
    subtext: "Every answer cites its source. No tax jargon to decode.",
  },
  {
    icon: "🧾",
    headline: "Leave with a compliant invoice, ready to send.",
    subtext: "Correct fields, correct wording, generated for you.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="text-3xl font-extrabold tracking-tight text-tf-ink">
          Not sure how to invoice a client?
        </h1>
        <p className="mt-2 text-tf-gray">
          Ask the AI Tax Assistant your real question and see how it handles German VAT — before you
          create an account.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        {VALUE_PROPS.map((v) => (
          <div key={v.headline} className="flex gap-3 rounded-tf-lg border border-tf-divider bg-tf-surface p-4">
            <span aria-hidden className="text-xl leading-none">{v.icon}</span>
            <div>
              <p className="text-sm font-bold text-tf-ink">{v.headline}</p>
              <p className="mt-1 text-sm text-tf-gray">{v.subtext}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-1.5">
        <Link
          href="/assistant"
          className="w-full rounded-full bg-tf-green-strong px-5 py-3.5 text-center text-sm font-semibold text-white shadow-sm active:scale-[0.99]"
        >
          Try it, no account needed
        </Link>
        <p className="text-center text-xs text-tf-gray">Takes about a minute.</p>
      </section>
    </div>
  );
}
