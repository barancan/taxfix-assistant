"use client";

import { useEffect, useState } from "react";

/**
 * Renders a PDF by fetching it (with credentials) and displaying an object URL.
 * This sidesteps browser quirks where an <iframe src> subresource doesn't send
 * the session cookie, and gives us explicit error states + console logs instead
 * of a silent blank frame.
 */
export function PdfPreview({
  url,
  heightClass = "h-64",
  fit = "FitH",
}: {
  url: string;
  heightClass?: string;
  fit?: "FitH" | "Fit";
}) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setStatus("loading");
      try {
        const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(`[PdfPreview] ${url} -> HTTP ${res.status} ${res.statusText}`, body);
          if (!cancelled) {
            setStatus("error");
            setMessage(res.status === 404 ? "Preview unavailable (was this invoice created in a previous session?)." : `Couldn't load the PDF (HTTP ${res.status}).`);
          }
          return;
        }
        const blob = await res.blob();
        console.info(`[PdfPreview] ${url} -> ${blob.size} bytes, type=${blob.type}`);
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setBlobUrl(objectUrl);
          setStatus("ok");
        }
      } catch (err) {
        console.error(`[PdfPreview] ${url} -> fetch failed`, err);
        if (!cancelled) {
          setStatus("error");
          setMessage("Couldn't load the PDF.");
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (status === "loading") {
    return (
      <div className={`flex ${heightClass} w-full items-center justify-center bg-white text-sm text-tf-gray`}>
        Loading preview…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className={`flex ${heightClass} w-full flex-col items-center justify-center gap-2 bg-white px-4 text-center text-sm text-tf-gray`}>
        <span>{message}</span>
        <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-tf-green-dark underline">
          Try opening it directly
        </a>
      </div>
    );
  }
  return (
    <iframe
      src={`${blobUrl}#toolbar=0&navpanes=0&view=${fit}`}
      title="PDF preview"
      className={`block ${heightClass} w-full bg-white`}
    />
  );
}
