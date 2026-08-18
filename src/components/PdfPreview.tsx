"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Served from public/ by scripts/copy-pdf-worker.mjs — see that file for why. */
const WORKER_SRC = "/pdf.worker.min.mjs";

export type PdfPreviewStatus = "loading" | "ok" | "error";

/** pdf.js rejects with this when we cancel a render task; it is not a failure. */
function isRenderCancellation(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === "RenderingCancelledException";
}

/** pdf.js names its parse failures; anything else is a viewer/runtime problem. */
function isBadPdf(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return (
    name === "InvalidPDFException" ||
    name === "MissingPDFException" ||
    name === "UnexpectedResponseException"
  );
}

/**
 * Distinguish "the PDF is bad" from "the viewer never loaded". The worker probe
 * runs only on the failure path, so the happy path stays at one request.
 */
async function classifyFailure(err: unknown): Promise<{ message: string; detail: string }> {
  const detail = err instanceof Error ? err.message : String(err);

  if (isBadPdf(err)) return { message: "This invoice PDF looks corrupted.", detail };

  try {
    const probe = await fetch(WORKER_SRC, { method: "HEAD", cache: "no-store" });
    if (!probe.ok) {
      return { message: "PDF viewer failed to load.", detail: `${WORKER_SRC} → HTTP ${probe.status}` };
    }
  } catch {
    return { message: "PDF viewer failed to load.", detail: `${WORKER_SRC} is unreachable` };
  }

  return { message: "Couldn't render the PDF preview.", detail };
}

/**
 * Cross-browser PDF preview. Fetches the PDF with credentials (so the session
 * cookie is sent) and rasterizes page 1 onto a <canvas> via pdf.js. This works
 * everywhere — including mobile browsers and device emulation, where inline
 * <iframe>/<embed> PDF viewers render a blank frame. Errors are logged and
 * surfaced with enough detail to triage from a screenshot.
 */
export function PdfPreview({
  url,
  heightClass = "h-64",
  onStatusChange,
}: {
  url: string;
  heightClass?: string;
  onStatusChange?: (status: PdfPreviewStatus) => void;
}) {
  const [status, setStatus] = useState<PdfPreviewStatus>("loading");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Kept in a ref so a new callback identity doesn't re-run the render effect.
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const publishStatus = useCallback((next: PdfPreviewStatus) => {
    setStatus(next);
    onStatusChangeRef.current?.(next);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;

    const fail = (msg: string, det = "") => {
      if (cancelled) return;
      setMessage(msg);
      setDetail(det);
      publishStatus("error");
    };

    (async () => {
      publishStatus("loading");
      try {
        const res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
        if (!res.ok) {
          console.error(`[PdfPreview] ${url} -> HTTP ${res.status}`);
          fail(
            res.status === 404
              ? "Preview unavailable — this invoice may belong to an earlier session."
              : `Couldn't load the PDF (HTTP ${res.status}).`,
          );
          return;
        }
        const data = await res.arrayBuffer();
        console.info(`[PdfPreview] ${url} -> ${data.byteLength} bytes; rendering with pdf.js`);

        // The *legacy* build is required, not a nice-to-have. The modern build
        // calls Map.prototype.getOrInsertComputed (the TC39 upsert proposal)
        // with no polyfill, so on any browser without it every render dies with
        // "…getOrInsertComputed is not a function". Legacy bundles the core-js
        // polyfill. Must stay in lockstep with the worker copied by
        // scripts/copy-pdf-worker.mjs — mixing builds is unsupported.
        const pdfjs = (await import(
          "pdfjs-dist/legacy/build/pdf.mjs"
        )) as typeof import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = WORKER_SRC;

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

        // Held so cleanup can cancel it — a second render on the same canvas is
        // rejected by pdf.js and would surface as a bogus preview failure.
        const task = page.render({ canvas, canvasContext: ctx, viewport });
        renderTask = task;
        await task.promise;
        renderTask = null;

        console.info(`[PdfPreview] rendered page 1/${doc.numPages} at ${canvas.width}x${canvas.height}`);
        if (!cancelled) publishStatus("ok");
      } catch (err) {
        if (isRenderCancellation(err) || cancelled) return;
        console.error(`[PdfPreview] ${url} -> render failed`, err);
        const { message: msg, detail: det } = await classifyFailure(err);
        fail(msg, det);
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [url, publishStatus]);

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
          {detail ? <span className="text-xs opacity-60">{detail}</span> : null}
        </div>
      ) : null}
      <canvas ref={canvasRef} className={status === "ok" ? "block" : "invisible"} aria-label="Invoice PDF preview" />
    </div>
  );
}
