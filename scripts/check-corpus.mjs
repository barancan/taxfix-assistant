#!/usr/bin/env node
// Structural validation of the committed official source corpus. Runs on plain
// JSON (no build step) so it can gate CI directly. The engine additionally
// re-validates with zod at runtime and fails closed.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "..", "src", "corpus");

const REQUIRED = [
  "sourceId",
  "jurisdiction",
  "officialTitle",
  "officialTitleEn",
  "issuingAuthority",
  "legalSection",
  "topic",
  "excerpt",
  "excerptEn",
  "url",
  "effectiveDate",
  "retrievedDate",
  "supportedRuleIds",
  "language",
  "verificationStatus",
];

const isDate = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

const errors = [];
const ids = new Set();
const files = readdirSync(DIR).filter((f) => f.endsWith(".json"));

for (const file of files) {
  let src;
  try {
    src = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  } catch (e) {
    errors.push(`${file}: invalid JSON (${e.message})`);
    continue;
  }
  for (const key of REQUIRED) {
    if (src[key] === undefined || src[key] === null || src[key] === "") {
      errors.push(`${file}: missing required field "${key}"`);
    }
  }
  if (ids.has(src.sourceId)) errors.push(`${file}: duplicate sourceId "${src.sourceId}"`);
  ids.add(src.sourceId);
  if (!isDate(src.effectiveDate)) errors.push(`${file}: bad effectiveDate`);
  if (!isDate(src.retrievedDate)) errors.push(`${file}: bad retrievedDate`);
  if (src.supersededDate != null && !isDate(src.supersededDate))
    errors.push(`${file}: bad supersededDate`);
  if (!/^https:\/\//.test(src.url ?? "")) errors.push(`${file}: url must be https`);
  if (!Array.isArray(src.supportedRuleIds) || src.supportedRuleIds.length === 0)
    errors.push(`${file}: supportedRuleIds must be a non-empty array`);
  if (src.verificationStatus !== "verified")
    errors.push(`${file}: verificationStatus is "${src.verificationStatus}" (must be verified to ship)`);
}

if (errors.length) {
  console.error(`❌ Corpus validation failed (${errors.length} issue(s)):`);
  for (const e of errors) console.error("   " + e);
  process.exit(1);
}
console.log(`✅ Corpus OK: ${files.length} source(s), ${ids.size} unique id(s).`);
