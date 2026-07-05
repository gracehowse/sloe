#!/usr/bin/env node

/**
 * ENG-1007 — Spacing-scale census + only-shrink ratchet (mobile).
 *
 * Gives teeth to the "spacing snaps to the scale" rule (root
 * `.claude/CLAUDE.md` UI write discipline + `_project-context.md` Design
 * craft contract). The rule existed only in review agents, so off-scale
 * literals (an 18px padding, a 10px gap) kept landing in code and were
 * only ever caught in a manual sweep — if at all. This script is the gate.
 *
 * What it flags:
 *   Numeric literals assigned to a spacing prop in a mobile `.tsx`:
 *     padding | margin | gap | paddingHorizontal | paddingVertical |
 *     paddingTop/Bottom/Left/Right/Start/End | marginTop/Bottom/Left/
 *     Right/Horizontal/Vertical/Start/End | rowGap | columnGap | inset
 *   that are NOT on the canonical Spacing scale AND are not a `Spacing.*`
 *   token reference. The legal scale is read at runtime from
 *   `apps/mobile/constants/theme.ts` (`Spacing`) — never hardcoded — so
 *   when the scale changes (e.g. ENG-1012 adding 12) the gate follows.
 *   `0` is always legal (a layout reset, not a rhythm value).
 *
 * Scope: `apps/mobile/app` + `apps/mobile/components` `.tsx` only (the
 * spacing scale + `Spacing` token are RN/StyleSheet concerns; web uses the
 * Tailwind spacing scale, gated separately).
 *
 * Comments are stripped before scanning, so a hex/px referenced in a doc
 * comment ("the 8→16 jump") never reads as a violation.
 *
 * Ratchet model (same as `check-screen-line-budget.mjs`):
 *   - The current off-scale population is pinned PER FILE in
 *     `scripts/spacing-budget.json` (`{ pins: { "<path>": <count> }, allow:
 *     { "<path>": "<rationale / ENG-ref>" } }`). A pinned file may only
 *     SHRINK — adding an off-scale literal fails CI.
 *   - Any file NOT pinned that introduces an off-scale literal fails CI.
 *   - `allow` entries are full-file carve-outs and MUST carry a non-empty
 *     rationale that references an ENG id or "intentional" reason — a
 *     silent carve-out (empty string) is itself a failure.
 *
 * Usage:
 *   node scripts/check-spacing-scale.mjs            # check (CI)
 *   node scripts/check-spacing-scale.mjs --write    # regenerate pins
 *
 * Exit 0 on clean, exit 1 with a `file:line current → nearest-legal`
 * report otherwise. Wired into `npm run check:spacing-scale` and CI.
 *
 * The `stripComments`/`walk`/`loadBudget`/`writeBudget`/`evaluate`/CLI
 * scaffolding is shared with the token, type-scale-mobile, and
 * screen-line-budget gates — see `scripts/lib/ratchet.mjs` (ENG-1363).
 * Only the spacing-specific regex + theme parsing lives here.
 */

import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  REPO_ROOT,
  stripComments,
  walk as sharedWalk,
  nearestLegal,
  evaluateKeyed as evaluate,
  runKeyedCli,
  isInvokedDirectly,
} from "./lib/ratchet.mjs";

const BUDGET_FILE = join(REPO_ROOT, "scripts", "spacing-budget.json");
const THEME_FILE = join(REPO_ROOT, "apps", "mobile", "constants", "theme.ts");

/** Dirs the spacing rule targets (relative to repo root). Mobile only. */
export const SCAN_DIRS = ["apps/mobile/app", "apps/mobile/components"];

const SCAN_EXT = ".tsx";

/** Spacing props whose numeric literal must land on the scale. */
const SPACING_PROPS = [
  "padding",
  "paddingHorizontal",
  "paddingVertical",
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "paddingStart",
  "paddingEnd",
  "margin",
  "marginHorizontal",
  "marginVertical",
  "marginTop",
  "marginBottom",
  "marginLeft",
  "marginRight",
  "marginStart",
  "marginEnd",
  "gap",
  "rowGap",
  "columnGap",
  "inset",
];

const PROP_RE = new RegExp(
  `\\b(${SPACING_PROPS.join("|")})\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\b`,
  "g",
);

/**
 * Read the canonical legal spacing values from `theme.ts` (`Spacing`).
 * Parsed at runtime so the gate always reflects the source of truth —
 * e.g. ENG-1012 adding `dense: 12`. `0` (layout reset) is always legal.
 */
export function readLegalSpacing(themeSrc = readFileSync(THEME_FILE, "utf8")) {
  const block = themeSrc.match(/export const Spacing\s*=\s*\{([\s\S]*?)\}/);
  if (!block) {
    throw new Error("check:spacing-scale — could not find `export const Spacing` in theme.ts");
  }
  const values = new Set([0]); // 0 is a reset, always legal
  const valRe = /:\s*(\d+(?:\.\d+)?)\s*,/g;
  let m;
  while ((m = valRe.exec(block[1])) !== null) {
    values.add(parseFloat(m[1]));
  }
  if (values.size <= 1) {
    throw new Error("check:spacing-scale — parsed an empty Spacing scale from theme.ts");
  }
  return values;
}

export { stripComments };

/**
 * Scan a single source file's text and return its off-scale findings as
 * `[{ line, prop, value, nearest }]`. Pure (no filesystem) so tests can
 * drive it with synthetic source.
 */
export function findOffScale(src, legal) {
  const code = stripComments(src);
  const lines = code.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    let m;
    PROP_RE.lastIndex = 0;
    while ((m = PROP_RE.exec(lines[i])) !== null) {
      const value = parseFloat(m[2]);
      if (!legal.has(value)) {
        hits.push({ line: i + 1, prop: m[1], value, nearest: nearestLegal(value, legal) });
      }
    }
  }
  return hits;
}

/** Walk the tree and return `{ "<repo-relative path>": [hits] }`. */
export function scanTree(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS, legal = readLegalSpacing()) {
  const byFile = {};
  for (const d of scanDirs) {
    for (const abs of sharedWalk(join(repoRoot, d), [], [SCAN_EXT])) {
      const hits = findOffScale(readFileSync(abs, "utf8"), legal);
      if (hits.length > 0) byFile[relative(repoRoot, abs)] = hits;
    }
  }
  return byFile;
}

export { evaluate };

function describeHit(h) {
  return `${h.prop}: ${h.value} → ${h.nearest}`;
}

function main() {
  const legal = readLegalSpacing();
  const sortedLegal = [...legal].sort((a, b) => a - b).join(" / ");
  runKeyedCli({
    name: "check:spacing-scale",
    budgetFile: BUDGET_FILE,
    scan: () => scanTree(REPO_ROOT, SCAN_DIRS, legal),
    describeHit,
    writeNoun: "off-scale spacing literals",
    shedNoun: "off-scale literals",
    droppedOutLabel: "fully on-scale",
    okNoun: "legacy off-scale literals",
    newHitNoun: (count) => `${count} off-scale spacing literal(s)`,
    grewHitNoun: (count) => `${count} off-scale literal(s)`,
    legalLabel: `Legal scale: ${sortedLegal}.`,
    guidance:
      `Spacing snaps to the scale: ${sortedLegal} ` +
      `(use \`Spacing.*\` from apps/mobile/constants/theme.ts). The gate is a ratchet — it can\n` +
      `only ever tighten. Move the literal onto a token, or if you are legitimately shrinking\n` +
      `a pinned file, re-pin it lower with:\n` +
      `  node scripts/check-spacing-scale.mjs --write`,
  });
}

if (isInvokedDirectly(import.meta.url)) main();
