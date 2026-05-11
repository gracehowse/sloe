#!/usr/bin/env node
/**
 * Visual-sweep baseline diff (sweep tooling #3 from the
 * docs/audits/visual-sweep-expanded/README.md known-improvements list).
 *
 * Compares the current visual-sweep captures against a stored baseline
 * using pixelmatch. Reports per-screen diff %, writes a side-by-side
 * diff image for any screen that exceeds the threshold, and exits
 * non-zero if any meaningful regression is detected.
 *
 * Usage:
 *   node apps/mobile/scripts/diff-visual-sweep.mjs            # compare
 *   node apps/mobile/scripts/diff-visual-sweep.mjs --update   # accept current as new baseline
 *
 * Directories:
 *   Current:  docs/audits/visual-sweep-expanded/*.png
 *   Baseline: docs/audits/visual-sweep-baseline/*.png
 *   Diff:     docs/audits/visual-sweep-diff/*.png    (only files that exceed threshold)
 *
 * Default threshold: 1% of pixels differing. Override with --threshold=2.
 *
 * Exit codes:
 *   0  — all screens within threshold (or --update mode)
 *   1  — at least one screen exceeded threshold (regression)
 *   2  — baseline missing for at least one current screen
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..");
const CURRENT_DIR = join(repoRoot, "docs/audits/visual-sweep-expanded");
const BASELINE_DIR = join(repoRoot, "docs/audits/visual-sweep-baseline");
const DIFF_DIR = join(repoRoot, "docs/audits/visual-sweep-diff");

const args = process.argv.slice(2);
const updateMode = args.includes("--update");
const thresholdArg = args.find((a) => a.startsWith("--threshold="));
const thresholdPct = thresholdArg ? Number(thresholdArg.split("=")[1]) : 1;

mkdirSync(BASELINE_DIR, { recursive: true });
mkdirSync(DIFF_DIR, { recursive: true });

if (!existsSync(CURRENT_DIR)) {
  console.error(`[diff-visual-sweep] current dir missing: ${CURRENT_DIR}`);
  console.error("[diff-visual-sweep] run the sweep first via scripts/run-visual-sweep.sh");
  process.exit(2);
}

const currentFiles = readdirSync(CURRENT_DIR)
  .filter((f) => f.endsWith(".png") && !f.startsWith("."))
  .sort();

if (currentFiles.length === 0) {
  console.error(`[diff-visual-sweep] no captures in ${CURRENT_DIR}`);
  process.exit(2);
}

if (updateMode) {
  console.log(`[diff-visual-sweep] --update: copying ${currentFiles.length} captures → baseline`);
  for (const f of currentFiles) {
    writeFileSync(join(BASELINE_DIR, f), readFileSync(join(CURRENT_DIR, f)));
  }
  console.log("[diff-visual-sweep] baseline updated.");
  process.exit(0);
}

const results = [];
let regressionCount = 0;
let missingBaseline = 0;

for (const fname of currentFiles) {
  const curPath = join(CURRENT_DIR, fname);
  const basePath = join(BASELINE_DIR, fname);
  if (!existsSync(basePath)) {
    results.push({ fname, status: "no-baseline", diffPct: null });
    missingBaseline += 1;
    continue;
  }
  const cur = PNG.sync.read(readFileSync(curPath));
  const base = PNG.sync.read(readFileSync(basePath));
  if (cur.width !== base.width || cur.height !== base.height) {
    results.push({
      fname,
      status: "size-changed",
      diffPct: null,
      detail: `cur=${cur.width}x${cur.height} base=${base.width}x${base.height}`,
    });
    regressionCount += 1;
    continue;
  }
  const { width, height } = cur;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(cur.data, base.data, diff.data, width, height, {
    threshold: 0.15,
  });
  const diffPct = (diffPixels / (width * height)) * 100;
  const status = diffPct > thresholdPct ? "REGRESSED" : "ok";
  if (status === "REGRESSED") {
    regressionCount += 1;
    writeFileSync(join(DIFF_DIR, fname), PNG.sync.write(diff));
  }
  results.push({ fname, status, diffPct: diffPct.toFixed(3) });
}

console.log("");
console.log("Visual-sweep baseline diff");
console.log("──────────────────────────");
for (const r of results) {
  const mark =
    r.status === "ok" ? "  " :
    r.status === "no-baseline" ? "??" :
    r.status === "size-changed" ? "‼ " :
    "✗ ";
  const pctStr = r.diffPct !== null ? `${r.diffPct}%` : "—";
  console.log(`  ${mark} ${r.fname.padEnd(40)}  ${pctStr.padStart(8)}  ${r.status}${r.detail ? "  (" + r.detail + ")" : ""}`);
}
console.log("");
console.log(`  Threshold: ${thresholdPct}% of pixels`);
console.log(`  Total:     ${results.length}`);
console.log(`  Regressions: ${regressionCount}`);
console.log(`  Missing baseline: ${missingBaseline}`);
if (regressionCount > 0) {
  console.log(`  Diff images: ${DIFF_DIR}`);
  console.log("");
  console.log("  Accept current state as the new baseline with --update.");
}
console.log("");

if (regressionCount > 0) process.exit(1);
if (missingBaseline > 0 && !updateMode) {
  console.log("  Tip: --update to seed baseline from current captures.");
  process.exit(2);
}
process.exit(0);
