#!/usr/bin/env node

/**
 * ENG-717 — Screen / component line-count ratchet.
 *
 * Gives teeth to the "No screen file over 400 lines" rule (root
 * `.claude/CLAUDE.md` quality bar + `_project-context.md` "Screen file
 * size limit"). The rule had no enforcement, so flagship files quietly
 * grew (mobile `(tabs)/index.tsx` ~7k lines, web `NutritionTracker.tsx`
 * ~4k). This script is the gate.
 *
 * Behaviour:
 *   - Scans the screen/component dirs the rule targets:
 *       web    : src/app/components, app
 *       mobile : apps/mobile/app, apps/mobile/components
 *     for `.tsx` files (screen + component surfaces — API route handlers
 *     under `app/api/**` are `.ts` and not "screens", so they're out of
 *     scope by design).
 *   - The current offenders are allow-listed in
 *     `scripts/screen-line-budget.json`, each PINNED at its current line
 *     count. An allow-listed file may only SHRINK — growing past its pin
 *     fails CI.
 *   - Any file NOT in the allow-list that crosses 400 lines fails CI.
 *
 * This is a ratchet, not a freeze: the limit can only ever tighten.
 * When an allow-listed file shrinks below its pin, the script prints a
 * "tighten me" note (non-fatal) and `--write` re-pins it lower; once a
 * file drops to 400 or below it leaves the allow-list entirely and is
 * then held to the hard 400 line.
 *
 * Usage:
 *   node scripts/check-screen-line-budget.mjs            # check (CI)
 *   node scripts/check-screen-line-budget.mjs --write    # regenerate pins
 *
 * Exit 0 on clean, exit 1 with a violation report otherwise.
 * Wired into `npm run check:screen-budget` and CI.
 *
 * The `walk`/`loadBudget`/`writeBudget`/`evaluate`/CLI scaffolding is
 * shared with the spacing, token, and type-scale-mobile gates — see
 * `scripts/lib/ratchet.mjs` (ENG-1363). Only the line-counting rule
 * itself lives here.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  REPO_ROOT,
  walk as sharedWalk,
  evaluateFlat,
  runFlatCli,
  isInvokedDirectly,
} from "./lib/ratchet.mjs";

const BUDGET_FILE = join(REPO_ROOT, "scripts", "screen-line-budget.json");

/** The hard ceiling every in-scope file must stay at or below once it is
 *  not (or no longer) an allow-listed legacy offender. */
export const HARD_LIMIT = 400;

/** Dirs the 400-line screen rule targets (relative to repo root). */
export const SCAN_DIRS = [
  "src/app/components",
  "app",
  "apps/mobile/app",
  "apps/mobile/components",
];

/** Only screen / component surfaces. API route handlers (`app/api/**`,
 *  `.ts`) are not screens and are intentionally excluded. */
const SCAN_EXT = ".tsx";

/**
 * Count lines the same way `wc -l` does (number of newline characters),
 * so the pinned budgets match what a contributor sees from `wc -l`.
 */
export function countLines(content) {
  let n = 0;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) n++;
  }
  return n;
}

/** Returns a sorted `{ "<repo-relative path>": <lineCount> }` map for
 *  every in-scope file currently over the hard limit. */
export function scanOffenders(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS) {
  const offenders = {};
  for (const d of scanDirs) {
    const files = sharedWalk(join(repoRoot, d), [], [SCAN_EXT]);
    for (const abs of files) {
      const lines = countLines(readFileSync(abs, "utf8"));
      if (lines > HARD_LIMIT) {
        offenders[relative(repoRoot, abs)] = lines;
      }
    }
  }
  // Stable, diff-friendly ordering by path.
  return Object.fromEntries(Object.entries(offenders).sort(([a], [b]) => a.localeCompare(b)));
}

/**
 * Pure evaluator (kept exported + side-effect-free so tests can drive it
 * with synthetic inputs). Given the current offender map and the pinned
 * allow-list, returns the violations and the shrink notices.
 */
export function evaluate(current, pinned) {
  return evaluateFlat(current, pinned, { hardLimit: HARD_LIMIT, limitLabel: "line screen limit" });
}

function main() {
  runFlatCli({
    name: "check:screen-budget",
    budgetFile: BUDGET_FILE,
    scan: () => scanOffenders(),
    hardLimit: HARD_LIMIT,
    limitLabel: "line screen limit",
    guidance:
      `The ${HARD_LIMIT}-line screen rule is a ratchet. Extract a \`use<Screen>()\` hook or split\n` +
      `child components into their own files to get back under budget. If you are\n` +
      `legitimately shrinking an allow-listed file, re-pin it lower with:\n` +
      `  node scripts/check-screen-line-budget.mjs --write`,
  });
}

if (isInvokedDirectly(import.meta.url)) main();
