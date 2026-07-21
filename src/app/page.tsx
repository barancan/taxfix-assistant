import Link from "next/link";

export default function HomePage() {
  const taxYear = new Date().getFullYear();
  return (
    <div className="flex flex-col gap-6">
      <section>
        <p className="text-sm font-medium text-tf-gray">Tax year {taxYear}</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-tf-ink">
          Hi Alex 👋
        </h1>
        <p className="mt-2 text-tf-gray">
          Your taxes are on track. Need to send an invoice? The Assistant works out
          the right VAT treatment and prepares a compliant PDF.
        </p>
      </section>

      <Link
        href="/assistant"
        className="group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-tf-lg bg-tf-green-pale p-5 ring-1 ring-tf-green/20 transition active:scale-[0.99]"
      >
        <div>
          <span className="inline-flex items-center gap-1 rounded-full bg-tf-surface/70 px-2.5 py-1 text-xs font-semibold text-tf-green-dark">
            ✨ AI Tax Assistant
          </span>
          <h2 className="mt-3 text-2xl font-extrabold leading-tight tracking-tight text-tf-ink">
            Invoice a client in minutes
          </h2>
          <p className="mt-1.5 text-sm text-tf-gray">
            Tell me who you’re billing — I’ll pick the right VAT treatment, cite the
            law, and build a compliant PDF.
          </p>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-tf-green-dark">Start a conversation</span>
          <span
            aria-hidden
            className="flex h-12 w-12 items-center justify-center rounded-full bg-tf-green-strong text-xl text-white shadow-sm transition group-active:scale-95"
          >
            →
          </span>
        </div>
      </Link>

      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/invoices"
          className="rounded-tf border border-tf-divider bg-tf-surface p-4 text-sm font-semibold text-tf-ink"
        >
          Invoices
          <span className="mt-1 block text-xs font-normal text-tf-gray">
            History & downloads
          </span>
        </Link>
        <Link
          href="/account"
          className="rounded-tf border border-tf-divider bg-tf-surface p-4 text-sm font-semibold text-tf-ink"
        >
          Account
          <span className="mt-1 block text-xs font-normal text-tf-gray">
            Your Taxfix profile
          </span>
        </Link>
      </section>
    </div>
  );
}
