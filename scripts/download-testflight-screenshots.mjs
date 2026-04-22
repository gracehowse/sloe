#!/usr/bin/env node
// Downloads TestFlight screenshot attachments referenced by the most
// recent `fetch-testflight-feedback.mjs` run. Writes each asset to
// docs/testflight-feedback/data/screenshots/<id>/<n>.jpg so we can
// triage a submission back to the actual surface the tester
// captured.
//
// Usage:
//   node scripts/download-testflight-screenshots.mjs              # all
//   node scripts/download-testflight-screenshots.mjs AIC05 AERuv  # by ID prefix

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = resolve(REPO_ROOT, "docs/testflight-feedback/data");
const OUT_ROOT = resolve(DATA_DIR, "screenshots");

async function main() {
  const idPrefixes = process.argv.slice(2);
  const rawPath = findMostRecentRaw();
  if (!rawPath) {
    console.error(`No feedback-YYYY-MM-DD-raw.json in ${DATA_DIR}. Run npm run testflight:feedback first.`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(rawPath, "utf8"));
  const rows = raw.screenshots?.data ?? [];
  const filtered = idPrefixes.length
    ? rows.filter((r) => idPrefixes.some((p) => r.id.startsWith(p)))
    : rows;

  console.log(`Loaded ${rows.length} submissions from ${rawPath}.`);
  console.log(`Downloading ${filtered.length} (filter: ${idPrefixes.join(",") || "none"}).`);

  mkdirSync(OUT_ROOT, { recursive: true });
  let downloaded = 0;
  let skipped = 0;
  for (const row of filtered) {
    const shots = row.attributes?.screenshots ?? [];
    const dir = resolve(OUT_ROOT, row.id);
    mkdirSync(dir, { recursive: true });
    for (let i = 0; i < shots.length; i++) {
      const { url } = shots[i] ?? {};
      if (!url) continue;
      const out = resolve(dir, `${i + 1}.jpg`);
      if (existsSync(out) && statSync(out).size > 0) {
        skipped++;
        continue;
      }
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`  ${row.id}[${i}] HTTP ${res.status} — skipped`);
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        writeFileSync(out, buf);
        downloaded++;
      } catch (err) {
        console.warn(`  ${row.id}[${i}] ${err instanceof Error ? err.message : err}`);
      }
    }
  }
  console.log(`\nDone. Downloaded ${downloaded}, skipped (cached) ${skipped}.`);
  console.log(`Images at: ${OUT_ROOT}`);
}

function findMostRecentRaw() {
  if (!existsSync(DATA_DIR)) return null;
  const candidates = readdirSync(DATA_DIR)
    .filter((f) => /^feedback-\d{4}-\d{2}-\d{2}-raw\.json$/.test(f))
    .sort()
    .reverse();
  return candidates.length ? resolve(DATA_DIR, candidates[0]) : null;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
