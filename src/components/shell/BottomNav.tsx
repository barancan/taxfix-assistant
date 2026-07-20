"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Taxes", match: (p: string) => p === "/" },
  { href: "/assistant", label: "Assistant", match: (p: string) => p.startsWith("/assistant") },
  { href: "/invoices", label: "Invoices", match: (p: string) => p.startsWith("/invoices") },
  { href: "/account", label: "Account", match: (p: string) => p.startsWith("/account") },
] as const;

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-md border-t border-tf-divider bg-tf-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="flex items-stretch justify-around">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-xs font-medium ${
                  active ? "text-tf-green-dark" : "text-tf-gray"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${active ? "bg-tf-green-strong" : "bg-transparent"}`}
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
