#!/usr/bin/env node
/**
 * ENG-629 — Ensure Today premium matrix PNGs exist for required pairs.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const CAPTURE_DIR = join(
  process.cwd(),
  "docs/ux/captures/today-premium-2026-05-19",
);

const STATES = [
  "empty-day",
  "one-meal",
  "active-fast",
  "eat-again",
  "deficit-insight",
  "over-budget",
];

/** Minimum set for PR / CI gate (light mobile-web pairs + desktop light). */
const REQUIRED = [
  ...STATES.flatMap((s) => [`${s}-mobile-web-light.png`]),
  ...STATES.map((s) => `${s}-desktop-light.png`),
];

function main() {
  if (!existsSync(CAPTURE_DIR)) {
    console.error(`[check-today-capture-pairs] missing dir: ${CAPTURE_DIR}`);
    process.exit(1);
  }
  const onDisk = new Set(readdirSync(CAPTURE_DIR).filter((f) => f.endsWith(".png")));
  const missing = REQUIRED.filter((f) => !onDisk.has(f));
  if (missing.length > 0) {
    console.error("[check-today-capture-pairs] missing required captures:");
    for (const f of missing) console.error(`  - ${f}`);
    console.error(
      "\nRe-run: npx tsx scripts/e2e-seed-today-premium-matrix.ts && " +
        "npx playwright test tests/e2e/screenshots/today-premium-2026-05-19.spec.ts",
    );
    process.exit(1);
  }
  console.log(
    `[check-today-capture-pairs] OK — ${REQUIRED.length} required PNGs present`,
  );
}

main();
