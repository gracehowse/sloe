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
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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

function walk(dir, acc) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip vendored / generated trees that aren't authored screens.
      if (entry.name === "node_modules" || entry.name === ".expo") continue;
      walk(full, acc);
    } else if (entry.isFile() && entry.name.endsWith(SCAN_EXT)) {
      acc.push(full);
    }
  }
  return acc;
}

/** Returns a sorted `{ "<repo-relative path>": <lineCount> }` map for
 *  every in-scope file currently over the hard limit. */
export function scanOffenders(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS) {
  const offenders = {};
  for (const d of scanDirs) {
    const files = walk(join(repoRoot, d), []);
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

function loadBudget() {
  if (!existsSync(BUDGET_FILE)) return {};
  return JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
}

function writeBudget(map) {
  writeFileSync(BUDGET_FILE, JSON.stringify(map, null, 2) + "\n", "utf8");
}

/**
 * Pure evaluator (kept exported + side-effect-free so tests can drive it
 * with synthetic inputs). Given the current offender map and the pinned
 * allow-list, returns the violations and the shrink notices.
 */
export function evaluate(current, pinned) {
  const failures = [];
  const shrinks = [];
  for (const [path, lines] of Object.entries(current)) {
    const pin = pinned[path];
    if (pin === undefined) {
      failures.push({
        path,
        lines,
        kind: "new",
        message: `crosses the ${HARD_LIMIT}-line screen limit (${lines} lines) and is not allow-listed`,
      });
    } else if (lines > pin) {
      failures.push({
        path,
        lines,
        pin,
        kind: "grew",
        message: `grew past its pinned budget (${lines} lines > ${pin} pinned)`,
      });
    } else if (lines < pin) {
      shrinks.push({ path, lines, pin });
    }
  }
  return { failures, shrinks };
}

function main() {
  const write = process.argv.includes("--write");
  const current = scanOffenders();

  if (write) {
    writeBudget(current);
    console.log(
      `[check:screen-budget] wrote ${Object.keys(current).length} pinned offenders to ${relative(REPO_ROOT, BUDGET_FILE)}.`,
    );
    return;
  }

  const pinned = loadBudget();
  const { failures, shrinks } = evaluate(current, pinned);

  // Allow-listed files that have since dropped to <= 400 left the
  // offender scan entirely; surface them so the pin can be removed.
  const droppedOut = Object.keys(pinned).filter((p) => current[p] === undefined);

  if (shrinks.length > 0) {
    console.log("[check:screen-budget] These files shrank below their pin — tighten with `--write`:");
    for (const s of shrinks) console.log(`  ${s.path}: ${s.lines} (pinned ${s.pin})`);
  }
  if (droppedOut.length > 0) {
    console.log(
      `[check:screen-budget] ${droppedOut.length} file(s) dropped to <=${HARD_LIMIT} lines — remove from the allow-list with \`--write\`:`,
    );
    for (const p of droppedOut) console.log(`  ${p}`);
  }

  if (failures.length === 0) {
    console.log(
      `[check:screen-budget] OK — ${Object.keys(current).length} allow-listed legacy offenders, none grew; no new file crossed ${HARD_LIMIT} lines.`,
    );
    return;
  }

  console.error(`\n[check:screen-budget] ${failures.length} violation(s):\n`);
  for (const f of failures) {
    console.error(`  x ${f.path} — ${f.message}`);
  }
  console.error(
    `\nThe ${HARD_LIMIT}-line screen rule is a ratchet. Extract a \`use<Screen>()\` hook or split\n` +
      `child components into their own files to get back under budget. If you are\n` +
      `legitimately shrinking an allow-listed file, re-pin it lower with:\n` +
      `  node scripts/check-screen-line-budget.mjs --write\n`,
  );
  process.exit(1);
}

// Only run when invoked directly (not when imported by the test).
const invokedDirectly =
  process.argv[1] && statSync(process.argv[1]).isFile() &&
  fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main();
