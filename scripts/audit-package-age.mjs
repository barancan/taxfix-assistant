#!/usr/bin/env node
// Package-age audit: fail if any resolved dependency was published within the
// last MIN_AGE_DAYS calendar days. Fails CLOSED when publish metadata cannot be
// verified (unless the package is listed in the documented allow-list below).
//
// Usage: node scripts/audit-package-age.mjs [--json] [--write-report]
// Docs:  docs/dependency-audit.md

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MIN_AGE_DAYS = 10;
const REGISTRY = "https://registry.npmjs.org";

// Documented manual exceptions. Each entry MUST include a rationale and the
// date it was approved. Keep this empty unless there is no eligible alternative.
const MANUAL_EXCEPTIONS = new Map([
  // "example@1.2.3": { rationale: "...", approvedOn: "2026-07-21" },
]);

const now = Date.now();
const cutoffMs = now - MIN_AGE_DAYS * 24 * 60 * 60 * 1000;

function readLockfile() {
  const raw = readFileSync(join(ROOT, "package-lock.json"), "utf8");
  return JSON.parse(raw);
}

// Collect unique name@version pairs from the lockfile v3 `packages` map.
function collectPackages(lock) {
  const out = new Map();
  const pkgs = lock.packages ?? {};
  for (const [path, info] of Object.entries(pkgs)) {
    if (path === "") continue; // root project
    if (!info || info.link) continue; // skip symlinks/workspaces
    // Derive the package name from the node_modules path, respecting scopes.
    const idx = path.lastIndexOf("node_modules/");
    let name = info.name;
    if (!name && idx !== -1) name = path.slice(idx + "node_modules/".length);
    const version = info.version;
    if (!name || !version) continue;
    out.set(`${name}@${version}`, { name, version });
  }
  return [...out.values()];
}

const cache = new Map();
async function publishDate(name, version) {
  const key = name;
  if (!cache.has(key)) {
    const url = `${REGISTRY}/${name.replace("/", "%2f")}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`registry ${res.status} for ${name}`);
    const json = await res.json();
    cache.set(key, json.time ?? {});
  }
  const time = cache.get(key);
  return time[version] ?? null;
}

async function main() {
  const writeReport = process.argv.includes("--write-report");
  const jsonOut = process.argv.includes("--json");
  const lock = readLockfile();
  const packages = collectPackages(lock);

  const rows = [];
  const violations = [];
  const unverifiable = [];

  await Promise.all(
    packages.map(async ({ name, version }) => {
      const id = `${name}@${version}`;
      try {
        const published = await publishDate(name, version);
        if (!published) {
          if (MANUAL_EXCEPTIONS.has(id)) {
            rows.push({ id, name, version, published: null, ageDays: null, note: "manual-exception" });
            return;
          }
          unverifiable.push(id);
          rows.push({ id, name, version, published: null, ageDays: null, note: "unverifiable" });
          return;
        }
        const publishedMs = new Date(published).getTime();
        const ageDays = Math.floor((now - publishedMs) / (24 * 60 * 60 * 1000));
        const tooNew = publishedMs > cutoffMs;
        if (tooNew && !MANUAL_EXCEPTIONS.has(id)) violations.push({ id, published, ageDays });
        rows.push({ id, name, version, published, ageDays });
      } catch (err) {
        if (MANUAL_EXCEPTIONS.has(id)) {
          rows.push({ id, name, version, published: null, ageDays: null, note: "manual-exception" });
          return;
        }
        unverifiable.push(`${id} (${err.message})`);
        rows.push({ id, name, version, published: null, ageDays: null, note: `error: ${err.message}` });
      }
    })
  );

  rows.sort((a, b) => (a.ageDays ?? -1) - (b.ageDays ?? -1));

  if (writeReport) {
    const report = {
      generatedAt: new Date(now).toISOString(),
      minAgeDays: MIN_AGE_DAYS,
      totalPackages: packages.length,
      violations,
      unverifiable,
      packages: rows,
    };
    writeFileSync(join(ROOT, "docs", "dependency-audit.report.json"), JSON.stringify(report, null, 2));
  }

  if (jsonOut) {
    console.log(JSON.stringify({ violations, unverifiable, count: packages.length }, null, 2));
  } else {
    console.log(`Audited ${packages.length} resolved packages (min age ${MIN_AGE_DAYS} days).`);
    if (violations.length) {
      console.error(`\n❌ ${violations.length} package(s) newer than ${MIN_AGE_DAYS} days:`);
      for (const v of violations) console.error(`   ${v.id}  published ${v.published} (${v.ageDays}d old)`);
    }
    if (unverifiable.length) {
      console.error(`\n❌ ${unverifiable.length} package(s) could not be verified (failing closed):`);
      for (const u of unverifiable) console.error(`   ${u}`);
    }
  }

  if (violations.length || unverifiable.length) {
    console.error("\nAudit FAILED. Pin older eligible versions or add npm overrides.");
    process.exit(1);
  }
  console.log("✅ All resolved packages satisfy the package-age policy.");
}

main().catch((err) => {
  console.error("Audit crashed (failing closed):", err);
  process.exit(1);
});
