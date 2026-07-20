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
        className="flex flex-col gap-1 rounded-tf-lg bg-tf-green-pale p-5 ring-1 ring-tf-green/20 transition active:scale-[0.99]"
      >
        <span className="text-lg font-bold text-tf-ink">Ask the Assistant</span>
        <span className="text-sm text-tf-gray">
          “I need to invoice a client in the US for 12,000 USD.”
        </span>
        <span className="mt-2 inline-flex w-fit rounded-full bg-tf-green-strong px-4 py-2 text-sm font-semibold text-white">
          Start
        </span>
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
