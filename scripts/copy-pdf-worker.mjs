#!/usr/bin/env node
// Publish the pdf.js worker as a static asset at /pdf.worker.min.mjs.
//
// PdfPreview must load the worker from a stable same-origin URL. The bundler
// asset-reference form `new URL("pdfjs-dist/build/pdf.worker.min.mjs",
// import.meta.url)` is only rewritten for *relative* specifiers — with a bare
// package specifier it resolves against the emitted chunk's location and 404s
// in a Turbopack production build, which silently breaks every preview.
//
// This copies the *legacy* build, which must stay in lockstep with the legacy
// `pdf.mjs` that PdfPreview imports — mixing builds across the main/worker
// boundary is unsupported. See PdfPreview for why legacy is required.
//
// Fails closed: if pdfjs-dist ever relocates the worker, the build breaks here
// rather than in production.

import { copyFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBLIC_DIR = join(ROOT, "public");
const DEST = join(PUBLIC_DIR, "pdf.worker.min.mjs");

const require = createRequire(import.meta.url);

let src;
try {
  src = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
} catch {
  console.error(
    "❌ Could not resolve pdfjs-dist/legacy/build/pdf.worker.min.mjs.\n" +
      "   The pdf.js worker moved or pdfjs-dist is not installed. PdfPreview\n" +
      "   loads it from /pdf.worker.min.mjs and will fail without it.",
  );
  process.exit(1);
}

if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true });
copyFileSync(src, DEST);

const { size } = statSync(DEST);
if (size === 0) {
  console.error("❌ Copied pdf.js worker is empty — refusing to ship a broken preview.");
  process.exit(1);
}

const { version } = require("pdfjs-dist/package.json");
console.log(`✅ pdf.js worker v${version} → public/pdf.worker.min.mjs (${Math.round(size / 1024)} KB)`);
