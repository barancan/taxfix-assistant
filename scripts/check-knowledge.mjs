#!/usr/bin/env node
// Structural validation of the curated knowledge base. Ensures every entry is
// well-formed and every cited sourceId exists in the committed corpus. Runs on
// plain JSON so it can gate CI directly; the loader also re-validates with zod.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const KB_FILE = join(ROOT, "src", "knowledge", "entries.json");
const CORPUS_DIR = join(ROOT, "src", "corpus");

const errors = [];

// Collect valid corpus source ids.
const corpusIds = new Set();
for (const f of readdirSync(CORPUS_DIR).filter((f) => f.endsWith(".json"))) {
  try {
    corpusIds.add(JSON.parse(readFileSync(join(CORPUS_DIR, f), "utf8")).sourceId);
  } catch (e) {
    errors.push(`corpus/${f}: invalid JSON (${e.message})`);
  }
}

const REQUIRED = ["entryId", "topic", "titleEn", "keywords", "questionExamples", "answerEn", "sourceIds", "scope", "verificationStatus"];

let kb;
try {
  kb = JSON.parse(readFileSync(KB_FILE, "utf8"));
} catch (e) {
  console.error(`❌ knowledge/entries.json: invalid JSON (${e.message})`);
  process.exit(1);
}

const ids = new Set();
for (const [i, entry] of (kb.entries ?? []).entries()) {
  const where = `entry[${i}]${entry.entryId ? ` (${entry.entryId})` : ""}`;
  for (const key of REQUIRED) {
    const v = entry[key];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
      errors.push(`${where}: missing/empty "${key}"`);
    }
  }
  if (ids.has(entry.entryId)) errors.push(`${where}: duplicate entryId`);
  ids.add(entry.entryId);
  if (!["explained", "general_guidance"].includes(entry.scope)) errors.push(`${where}: bad scope "${entry.scope}"`);
  if (entry.verificationStatus !== "verified") errors.push(`${where}: verificationStatus must be "verified" to ship`);
  for (const sid of entry.sourceIds ?? []) {
    if (!corpusIds.has(sid)) errors.push(`${where}: cites unknown corpus source "${sid}"`);
  }
}

if (errors.length) {
  console.error(`❌ Knowledge validation failed (${errors.length} issue(s)):`);
  for (const e of errors) console.error("   " + e);
  process.exit(1);
}
console.log(`✅ Knowledge OK: ${kb.entries.length} entr(ies), all sources resolve in the corpus.`);
