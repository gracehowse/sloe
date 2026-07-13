#!/usr/bin/env node

/**
 * ENG-1540 — UTC day-key recurrence guard (only-shrink ratchet, web + mobile).
 *
 * `new Date().toISOString().slice(0,10)` is the **UTC** calendar day. After
 * ~17:00–19:00 local in the Americas, UTC has already rolled to tomorrow, so
 * using it to seed "today" (or filter today's rows) shows the wrong day's
 * log/plan for exactly the launch-target cohort. This bug has recurred
 * multiple times (Build-41 class): each site gets fixed, then a fresh
 * `toISOString().slice(0,10)` reintroduces it. Nothing stopped reintroduction
 * — this is that write-time / CI gate.
 *
 * What it flags (a "UTC today-key"):
 *   The argless form `new Date().toISOString().slice(...)` — unambiguously
 *   "now, in UTC". A day KEY must instead come from the canonical LOCAL
 *   helper `dateKeyFromDate` (`src/lib/datetime/dateKey.ts`, mobile via
 *   `@suppr/shared/datetime/dateKey`), which uses local-calendar getters.
 *
 * Deliberately NOT flagged: `d.toISOString().slice(...)` on an explicit given
 * `Date` (that formats a specific instant, not "today"), and the UTC-bucketed
 * server counters that are intentionally UTC (`src/lib/server/aiBudget.ts`
 * `utcDateKey`, `falBudget.ts`, `weighInReminder.ts`) + the deliberately-UTC
 * persistence key (`src/context/appData/persistence.ts`) — none of those use
 * the argless `new Date()` form, so the narrow pattern already skips them.
 *
 * Ratchet model (same as `check-token-scale.mjs` / `check-web-radius.mjs`):
 * the current population is pinned PER FILE in `scripts/date-key-budget.json`
 * (`{ pins, allow }`). A pinned file may only SHRINK; a new file introducing
 * one fails CI. `allow` entries are full-file carve-outs and MUST carry a
 * rationale (export filenames, where a UTC datestamp is cosmetic, live here).
 *
 * Usage:
 *   node scripts/check-date-key.mjs            # check (CI)
 *   node scripts/check-date-key.mjs --write    # regenerate pins
 *
 * Exit 0 clean, exit 1 with a `file:line` report otherwise. Wired into
 * `npm run check:date-key` and `npm run ci`.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  REPO_ROOT,
  stripComments,
  walk as sharedWalk,
  evaluateKeyed as evaluate,
  runKeyedCli,
  isInvokedDirectly,
} from "./lib/ratchet.mjs";

const BUDGET_FILE = join(REPO_ROOT, "scripts", "date-key-budget.json");

/** App source — web (`src`, `app`) + mobile (`apps/mobile`). Day keys are
 *  derived across libs, routes, screens and components, so scan broadly. */
export const SCAN_DIRS = ["src", "app", "apps/mobile"];

const SCAN_EXTS = [".ts", ".tsx"];

// Test files carry the pattern as fixtures/assertions — never product code.
const IS_TEST = /(?:\.test\.|\.spec\.|[\\/]__tests__[\\/]|[\\/]tests[\\/])/;

// Argless `new Date().toISOString().slice(` — "now, in UTC", the exact
// recurring day-key bug. `new Date(x)` (an explicit instant) is intentionally
// not matched.
const UTC_TODAY_RE = /new Date\(\)\.toISOString\(\)\.slice\(/g;

/**
 * Scan one file's text → `[{ line, kind, token }]`. Pure (no filesystem) so
 * tests can drive it with synthetic source.
 *   kind: "utc-today"
 */
export function findViolations(src) {
  const code = stripComments(src);
  const lines = code.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    UTC_TODAY_RE.lastIndex = 0;
    while (UTC_TODAY_RE.exec(lines[i]) !== null) {
      hits.push({ line: i + 1, kind: "utc-today", token: "new Date().toISOString().slice(…)" });
    }
  }
  return hits;
}

/** Walk the tree and return `{ "<repo-relative path>": [hits] }`. */
export function scanTree(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS) {
  const byFile = {};
  for (const d of scanDirs) {
    for (const abs of sharedWalk(join(repoRoot, d), [], SCAN_EXTS)) {
      const rel = relative(repoRoot, abs);
      if (IS_TEST.test(rel)) continue;
      const hits = findViolations(readFileSync(abs, "utf8"));
      if (hits.length > 0) byFile[rel] = hits;
    }
  }
  return byFile;
}

export { evaluate, stripComments };

function describeHit() {
  return "new Date().toISOString().slice(…) → dateKeyFromDate(new Date()) (local day key)";
}

function main() {
  runKeyedCli({
    name: "check:date-key",
    budgetFile: BUDGET_FILE,
    scan: () => scanTree(),
    describeHit,
    writeNoun: "UTC today-key derivations",
    shedNoun: "UTC today-keys",
    droppedOutLabel: "on the local day-key helper",
    okNoun: "legacy UTC today-key derivations",
    newHitNoun: (count) => `${count} UTC today-key derivation(s)`,
    grewHitNoun: (count) => `${count} UTC today-key derivation(s)`,
    legalLabel:
      "Day keys come from `dateKeyFromDate` (local). UTC slice is only for export filenames / server counters.",
    guidance:
      "`new Date().toISOString().slice(0,10)` is the UTC day — it rolls to tomorrow after ~17:00\n" +
      "local in the Americas (the ENG-1540 / Build-41 regression). For any day KEY use\n" +
      "`dateKeyFromDate(new Date())` (`src/lib/datetime/dateKey.ts` / `@suppr/shared/datetime/dateKey`).\n" +
      "Only export filenames and deliberately-UTC server counters may slice — add them to `allow`\n" +
      "with a rationale. The gate is only-shrink; re-pin a legitimately-shrunk file with:\n" +
      "  node scripts/check-date-key.mjs --write",
  });
}

if (isInvokedDirectly(import.meta.url)) main();
