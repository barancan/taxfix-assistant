"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cross-browser PDF preview. Fetches the PDF with credentials (so the session
 * cookie is sent) and rasterizes page 1 onto a <canvas> via pdf.js. This works
 * everywhere — including mobile browsers and device emulation, where inline
 * <iframe>/<embed> PDF viewers render a blank frame. Errors are logged and
 * surfaced instead of failing silently.
 */
export function PdfPreview({
  url,
  heightClass = "h-64",
}: {
  url: string;
  heightClass?: string;
}) {
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("loading");
      try {
        const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
        if (!res.ok) {
          console.error(`[PdfPreview] ${url} -> HTTP ${res.status}`);
          if (!cancelled) {
            setStatus("error");
            setMessage(
              res.status === 404
                ? "Preview unavailable — this invoice may belong to an earlier session."
                : `Couldn't load the PDF (HTTP ${res.status}).`,
            );
          }
          return;
        }
        const data = await res.arrayBuffer();
        console.info(`[PdfPreview] ${url} -> ${data.byteLength} bytes; rendering with pdf.js`);

        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();

        const doc = await pdfjs.getDocument({ data }).promise;
        const page = await doc.getPage(1);
        if (cancelled) return;

        const canvas = canvasRef.current;
        const wrap = wrapRef.current;
        if (!canvas || !wrap) return;

        const base = page.getViewport({ scale: 1 });
        const cssWidth = wrap.clientWidth || 360;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scale = (cssWidth * dpr) / base.width;
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        console.info(`[PdfPreview] rendered page 1/${doc.numPages} at ${canvas.width}x${canvas.height}`);
        if (!cancelled) setStatus("ok");
      } catch (err) {
        console.error(`[PdfPreview] ${url} -> render failed`, err);
        if (!cancelled) {
          setStatus("error");
          setMessage("Couldn't render the PDF preview.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div ref={wrapRef} className={`relative w-full overflow-hidden ${heightClass} bg-white`}>
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-tf-gray">
          Loading preview…
        </div>
      ) : null}
      {status === "error" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-sm text-tf-gray">
          <span>{message}</span>
          <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-tf-green-dark underline">
            Try opening it directly
          </a>
        </div>
      ) : null}
      <canvas ref={canvasRef} className={status === "ok" ? "block" : "invisible"} aria-label="Invoice PDF preview" />
    </div>
  );
}
