#!/usr/bin/env node

/**
 * ENG-1358 — mobile raw `(../)+src/` relative-reach ratchet.
 *
 * Companion to `check-mobile-shared-imports.sh` (which verifies every
 * `@suppr/shared/*` / `@suppr/nutrition-core/*` import resolves). This
 * script flags the OTHER half of that boundary: mobile files that reach
 * into `src/` via a raw relative path (`../../../src/...`,
 * `../../../../src/...`, etc.) instead of going through the `@suppr/shared`
 * path alias (`apps/mobile/metro.config.js` / `tsconfig.json`).
 *
 * The ENG-1358 audit found ~12 such files (mostly type-only / constants
 * imports predating the alias convention) — this gate is an only-shrink
 * ratchet over that legacy population, same pattern as
 * `check-screen-line-budget.mjs` / `check-spacing-scale.mjs` / etc: the
 * current offenders are pinned per-file in
 * `scripts/mobile-relative-src-reach-budget.json`; a pinned file may only
 * shrink its count, and any NEW file introducing a raw reach fails.
 *
 * Usage:
 *   node scripts/check-mobile-relative-src-reach.mjs            # check (CI)
 *   node scripts/check-mobile-relative-src-reach.mjs --write    # regenerate pins
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { REPO_ROOT, stripComments, walk as sharedWalk, runFlatCli, isInvokedDirectly } from "./lib/ratchet.mjs";

const BUDGET_FILE = join(REPO_ROOT, "scripts", "mobile-relative-src-reach-budget.json");

/** Mirrors check-mobile-shared-imports.sh's scope (app/lib/components/hooks/context). */
export const SCAN_DIRS = [
  "apps/mobile/app",
  "apps/mobile/lib",
  "apps/mobile/components",
  "apps/mobile/hooks",
  "apps/mobile/context",
  "apps/mobile/constants",
  "apps/mobile/tests",
];

const SCAN_EXTS = [".ts", ".tsx"];

/** Matches `from "../src/..."`, `from "../../src/..."`, etc — any depth. */
const RAW_REACH_RE = /from\s+["'](?:\.\.\/)+src\/[^"']*["']/g;

/** Count raw `(../)+src/...` import specifiers in a file's text. Pure. */
export function countRawReaches(src) {
  const code = stripComments(src);
  const matches = code.match(RAW_REACH_RE);
  return matches ? matches.length : 0;
}

/** Walk the tree and return `{ "<repo-relative path>": <count> }` for files with >0 hits. */
export function scanTree(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS) {
  const byFile = {};
  for (const d of scanDirs) {
    for (const abs of sharedWalk(join(repoRoot, d), [], SCAN_EXTS)) {
      const count = countRawReaches(readFileSync(abs, "utf8"));
      if (count > 0) byFile[relative(repoRoot, abs)] = count;
    }
  }
  return byFile;
}

function main() {
  runFlatCli({
    name: "check:mobile-relative-src-reach",
    budgetFile: BUDGET_FILE,
    scan: () => scanTree(),
    hardLimit: 0,
    limitLabel: "raw-relative-src-reach limit",
    guidance:
      `Mobile files should reach shared web logic via the \`@suppr/shared/*\` path alias\n` +
      `(apps/mobile/metro.config.js maps it to ../../src/lib), not a raw \`../../../src/...\`\n` +
      `relative import. Move the file (or the piece you need) under \`src/lib/...\` and import\n` +
      `it as \`@suppr/shared/<path>\`, or if you are legitimately shrinking a pinned file's raw-\n` +
      `reach count, re-pin it lower with:\n` +
      `  node scripts/check-mobile-relative-src-reach.mjs --write`,
  });
}

if (isInvokedDirectly(import.meta.url)) main();
