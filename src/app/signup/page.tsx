import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight text-tf-ink">Create your free account</h1>
        <p className="mt-2 text-tf-gray">
          This is a demo prototype — sign-up isn&rsquo;t wired to a real account yet. In the full product this is
          where you&rsquo;d save your details, download and send invoices, and skip the setup next time.
        </p>
      </section>

      <div className="rounded-tf-lg border border-tf-divider bg-tf-surface p-4">
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-tf-gray">Email</label>
        <input
          type="email"
          disabled
          placeholder="you@example.com"
          className="w-full rounded-tf border border-tf-divider bg-tf-surface-muted px-3 py-2 text-sm text-tf-gray"
        />
        <button
          disabled
          className="mt-4 w-full rounded-full bg-tf-green-strong px-4 py-2.5 text-sm font-semibold text-white opacity-50"
        >
          Create account (disabled in demo)
        </button>
      </div>

      <Link href="/assistant" className="text-center text-sm font-semibold text-tf-green-dark">
        ← Back to the assistant
      </Link>
    </div>
  );
}
