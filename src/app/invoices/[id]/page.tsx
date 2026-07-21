"use client";

import { use } from "react";
import Link from "next/link";
import { PdfPreview } from "@/components/PdfPreview";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const pdfUrl = `/api/invoices/${id}/pdf`;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/invoices" className="text-sm text-tf-green-dark">← Invoices</Link>
      <h1 className="text-xl font-extrabold tracking-tight">Invoice preview</h1>
      <div className="overflow-hidden rounded-tf border border-tf-divider">
        <PdfPreview url={pdfUrl} heightClass="h-[70vh]" />
      </div>
      <a href={pdfUrl} target="_blank" rel="noreferrer" className="rounded-full bg-tf-green-strong px-5 py-3 text-center text-sm font-semibold text-white">
        Open / download PDF
      </a>
    </div>
  );
}
