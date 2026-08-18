import Link from "next/link";
import { getEnv } from "@/config/env";
import { Wordmark } from "./Wordmark";

/** Header + clear "Prototype" marker so no output looks like genuine tax advice. */
export function DemoBanner() {
  const { DEMO_MODE } = getEnv();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-tf-divider bg-tf-surface/95 px-5 py-3 backdrop-blur">
      <Link href="/" aria-label="Go to home">
        <Wordmark className="text-lg" />
      </Link>
      {DEMO_MODE ? (
        <span
          className="rounded-full bg-tf-yellow-pale px-2.5 py-1 text-xs font-semibold text-tf-amber"
          title="This is a prototype. Generated documents are not genuine tax advice."
        >
          Prototype · Demo
        </span>
      ) : null}
    </header>
  );
}
