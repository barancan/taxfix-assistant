"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/format";

interface Row {
  id: string;
  invoiceNumber: string;
  status: string;
  decisionCode: string;
  customerName: string;
  currency: string;
  totalMinor: string;
  createdAt: string;
}

export default function InvoicesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState<string>("local");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => { setRows(d.invoices ?? []); setMode(d.storageMode); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Invoices</h1>
      {mode === "local" ? (
        <p className="rounded-tf bg-tf-yellow-pale px-3 py-2 text-xs text-tf-amber">
          Local demo persistence — history is kept only for this browser session on this server.
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-tf-gray">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-tf-gray">No invoices yet. <Link href="/assistant" className="text-tf-green-dark underline">Create one.</Link></p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/invoices/${r.id}`} className="flex items-center justify-between rounded-tf border border-tf-divider bg-tf-surface p-3">
                <div>
                  <p className="font-mono text-sm">{r.invoiceNumber}</p>
                  <p className="text-xs text-tf-gray">{r.customerName} · {r.decisionCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{money(r.totalMinor, r.currency)}</p>
                  <p className={`text-xs ${r.status === "issued" ? "text-tf-green-dark" : "text-tf-danger"}`}>{r.status}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
