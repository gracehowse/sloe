#!/usr/bin/env node

/**
 * ENG-1519 — mobile Pressable-feedback census + only-shrink ratchet.
 *
 * The non-negotiable UI-write rule (root `.claude/CLAUDE.md`): "Pressables go
 * through `PressableScale` with the right `haptic` weight." The 2026-07-11 audit
 * found 84 mobile files with raw `<Pressable>` and ZERO press feedback — no
 * `PressableScale`, no `SupprButton`, no inline `({ pressed })` style function —
 * including the paywall CTA and the commit sheets (the highest-stakes taps).
 *
 * This gate pins that census only-shrink so (a) no NEW raw-feedbackless
 * `<Pressable>` lands and (b) the 84 legacy files migrate to `PressableScale`
 * incrementally without a big-bang PR. It is FILE-scoped by design: a file that
 * already imports `PressableScale` (mid-migration) is considered "has feedback"
 * and not counted — matching the audit census.
 *
 * What it flags:
 *   Each `<Pressable` in a mobile `.tsx` under apps/mobile/{app,components} when
 *   the file (comments stripped) contains NONE of the feedback signals:
 *   `PressableScale`, `SupprButton`, or an inline pressed-style `({ pressed })`.
 *
 * Usage:
 *   node scripts/check-pressable-feedback.mjs            # check (CI)
 *   node scripts/check-pressable-feedback.mjs --write    # regenerate pins
 *
 * Exit 0 clean; exit 1 with a `file:line` report otherwise. Shares the
 * stripComments/walk/evaluate/CLI scaffolding with the spacing/token/type/
 * screen ratchets (`scripts/lib/ratchet.mjs`, ENG-1363).
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  REPO_ROOT,
  stripComments,
  walk as sharedWalk,
  runKeyedCli,
  isInvokedDirectly,
} from "./lib/ratchet.mjs";

const BUDGET_FILE = join(REPO_ROOT, "scripts", "pressable-feedback-budget.json");

/** Dirs the rule targets (relative to repo root). Mobile only. */
export const SCAN_DIRS = ["apps/mobile/app", "apps/mobile/components"];
const SCAN_EXT = ".tsx";

// `\b` after "Pressable" matches the standalone component (`<Pressable`,
// `<Pressable>`, `<Pressable\n…`) but NOT `<PressableScale` (no word boundary
// between "Pressable" and "Scale"). Matched against the FULL text, not per line,
// so an opening tag whose props start on the next line still counts.
const PRESSABLE_RE = /<Pressable\b/g;
const INLINE_PRESSED_RE = /\(\s*\{\s*pressed\s*\}\s*\)/; // ({ pressed }) style fn

/**
 * A file "has feedback" if it routes presses through `PressableScale`, uses the
 * `SupprButton` primitive, or has at least one inline `({ pressed })` style. In
 * that case it is not counted (mid-migration or already-fed-back). Pure — tests
 * can drive it with synthetic source.
 */
export function fileHasFeedback(code) {
  return (
    code.includes("PressableScale") ||
    code.includes("SupprButton") ||
    INLINE_PRESSED_RE.test(code)
  );
}

/**
 * Scan a single file's text → `[{ line }]` for each raw feedbackless
 * `<Pressable`. Empty when the file has any feedback signal.
 */
export function findFeedbackless(src) {
  const code = stripComments(src);
  if (fileHasFeedback(code)) return [];
  const hits = [];
  PRESSABLE_RE.lastIndex = 0;
  let m;
  while ((m = PRESSABLE_RE.exec(code)) !== null) {
    // Line number from the match offset (opening tags often span lines).
    const line = code.slice(0, m.index).split("\n").length;
    hits.push({ line });
  }
  return hits;
}

/** Walk the tree → `{ "<repo-relative path>": [hits] }`. */
export function scanTree(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS) {
  const byFile = {};
  for (const d of scanDirs) {
    for (const abs of sharedWalk(join(repoRoot, d), [], [SCAN_EXT])) {
      const hits = findFeedbackless(readFileSync(abs, "utf8"));
      if (hits.length > 0) byFile[relative(repoRoot, abs)] = hits;
    }
  }
  return byFile;
}

function main() {
  runKeyedCli({
    name: "check:pressable-feedback",
    budgetFile: BUDGET_FILE,
    scan: () => scanTree(),
    describeHit: () => "<Pressable> with no press feedback",
    writeNoun: "raw feedbackless <Pressable>",
    shedNoun: "raw <Pressable>",
    droppedOutLabel: "now has press feedback",
    okNoun: "legacy raw feedbackless <Pressable>",
    newHitNoun: (count) => `${count} raw feedbackless <Pressable>`,
    grewHitNoun: (count) => `${count} raw feedbackless <Pressable>`,
    legalLabel: "Every Pressable routes through PressableScale (with a haptic weight) or SupprButton.",
    guidance:
      "Wrap the Pressable in `PressableScale` with the right `haptic` weight " +
      "(selection / confirm / warn / none), or use `SupprButton`. The gate is a\n" +
      "ratchet — it can only tighten. If you legitimately migrated a pinned file, " +
      "re-pin it lower with:\n" +
      "  node scripts/check-pressable-feedback.mjs --write",
  });
}

if (isInvokedDirectly(import.meta.url)) main();
