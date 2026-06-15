#!/usr/bin/env node
/**
 * ENG-670 — verify three consecutive green Reel audit days.
 *
 * Reads `docs/testing/audit-tiktok-reels-*.json` summaries and checks
 * whether the most recent three distinct calendar days each cleared
 * ≥90% parse rate on a full (non-sample) battery.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const THRESHOLD = 90;
const REQUIRED_GREEN_DAYS = 3;
const MIN_SAMPLE = 100;

const dir = join(process.cwd(), "docs/testing");
const files = readdirSync(dir)
  .filter((f) => /^audit-tiktok-reels-\d{4}-\d{2}-\d{2}\.json$/.test(f))
  .sort();

const byDate = new Map();

for (const file of files) {
  const date = file.replace("audit-tiktok-reels-", "").replace(".json", "");
  try {
    const raw = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const summary = raw.summary;
    if (!summary || typeof summary.successRatePct !== "number") continue;
    byDate.set(date, {
      successRatePct: summary.successRatePct,
      total: summary.total ?? 0,
      succeeded: summary.succeeded ?? 0,
      file,
    });
  } catch {
    /* skip malformed */
  }
}

const dates = [...byDate.keys()].sort();
const recent = dates.slice(-REQUIRED_GREEN_DAYS);

if (recent.length < REQUIRED_GREEN_DAYS) {
  console.error(
    `Need ${REQUIRED_GREEN_DAYS} audit JSON reports in docs/testing/; found ${dates.length}.`,
  );
  process.exit(1);
}

const failures = [];
for (const date of recent) {
  const row = byDate.get(date);
  if (row.total < MIN_SAMPLE) {
    failures.push(`${date}: sample too small (${row.total} < ${MIN_SAMPLE}) — ${row.file}`);
  } else if (row.successRatePct < THRESHOLD) {
    failures.push(`${date}: ${row.successRatePct}% < ${THRESHOLD}% — ${row.file}`);
  }
}

if (failures.length) {
  console.error("Reel audit streak NOT met (last 3 days):\n" + failures.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}

console.log(
  `Reel audit streak OK — last ${REQUIRED_GREEN_DAYS} days cleared ≥${THRESHOLD}% on ≥${MIN_SAMPLE} URLs:`,
);
for (const date of recent) {
  const row = byDate.get(date);
  console.log(`  ${date}: ${row.successRatePct}% (${row.succeeded}/${row.total})`);
}
