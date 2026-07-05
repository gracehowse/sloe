#!/usr/bin/env node

/**
 * ENG-1002 — Mobile type-scale census + only-shrink ratchet.
 *
 * Brings the MOBILE side to parity with the web `check:type-scale` gate
 * (ENG-119, `scripts/check-type-scale.mjs`), which enforces the canonical
 * type ladder on web `text-[Npx]` classes. On web the ladder lives in the
 * Tailwind theme; on mobile it lives in the `Type` ramp
 * (`apps/mobile/constants/theme.ts`). The rule "Type comes from the ramp —
 * no ad-hoc font sizes" (root `.claude/CLAUDE.md` UI write discipline +
 * `_project-context.md` Design craft contract) had teeth on web but none on
 * mobile, so raw `fontSize: N` literals off the ramp kept landing. This
 * script is the gate.
 *
 * What it flags:
 *   A numeric literal assigned to `fontSize:` in a mobile `.tsx` that is NOT
 *   on the canonical mobile type ramp AND is not a `Type.*` token reference
 *   (a `...Type.body` spread has no numeric literal, so it never matches).
 *
 * The legal ramp is `Type` ∪ micro ∪ display, computed at runtime:
 *   - RAMP  — every `fontSize` in `export const Type` in theme.ts, read at
 *     runtime (never hardcoded) so the gate follows the source of truth: as of
 *     ENG-1002 that is 11 / 13 / 14 / 16 / 17 / 18 / 20 / 22 / 24 / 28 / 32 /
 *     48 / 56.
 *   - MICRO (8 / 9 / 10) — sub-11 labels (chart axes, pill badges). Mirrors the
 *     web gate's grandfathered micro band; below the ramp's floor by design.
 *   - DISPLAY (36 / 40 / 44 / 52 / 60 / 64) — hero numerals larger than the
 *     ramp's routine top. Mirrors the web gate's display band (the ramp already
 *     covers 48 / 56 via `ringValue*`). Kept as a documented band, exactly like
 *     the web `ON_SCALE` set, so a hero readout isn't forced onto a ramp token.
 * `0` is not meaningful for `fontSize`, so (unlike the spacing gate) it is not
 * pre-seeded as legal.
 *
 * Scope: `apps/mobile/app` + `apps/mobile/components` `.tsx` only — the same
 * mobile surfaces the spacing/token/screen ratchets scan. Web type is gated by
 * `check:type-scale` (ENG-119) against `text-[Npx]` classes.
 *
 * Comments are stripped before scanning, so a size referenced in a doc comment
 * ("bumped 14→17 on 2026-06-04") never reads as a violation.
 *
 * Ratchet model (identical to `check-spacing-scale.mjs`):
 *   - The current off-ramp population is pinned PER FILE in
 *     `scripts/type-scale-mobile-budget.json` (`{ pins: { "<path>": <count> },
 *     allow: { "<path>": "<rationale / ENG-ref>" } }`). A pinned file may only
 *     SHRINK — adding an off-ramp literal fails CI.
 *   - Any file NOT pinned that introduces an off-ramp literal fails CI.
 *   - `allow` entries are full-file carve-outs and MUST carry a non-empty
 *     rationale (ENG ref / explicit "intentional" reason) — a silent carve-out
 *     (empty string) is itself a failure.
 *
 * Usage:
 *   node scripts/check-type-scale-mobile.mjs            # check (CI)
 *   node scripts/check-type-scale-mobile.mjs --write    # regenerate pins
 *
 * Exit 0 on clean, exit 1 with a `file:line current → nearest-legal` report
 * otherwise. Wired into `npm run check:type-scale-mobile` and CI.
 *
 * The `stripComments`/`walk`/`loadBudget`/`writeBudget`/`evaluate`/CLI
 * scaffolding is shared with the spacing, token, and screen-line-budget
 * gates — see `scripts/lib/ratchet.mjs` (ENG-1363). Only the type-scale
 * regex + theme parsing lives here.
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

const BUDGET_FILE = join(REPO_ROOT, "scripts", "type-scale-mobile-budget.json");
const THEME_FILE = join(REPO_ROOT, "apps", "mobile", "constants", "theme.ts");

/** Dirs the type rule targets (relative to repo root). Mobile only. */
export const SCAN_DIRS = ["apps/mobile/app", "apps/mobile/components"];

const SCAN_EXT = ".tsx";

/**
 * Micro band — sub-ramp label sizes (chart axes, pill badges). Mirrors the web
 * gate's grandfathered 8/9/10 micro allowance. Below the ramp floor by design.
 */
export const MICRO_SIZES = [8, 9, 10];

/**
 * Display band — hero numerals above the ramp's routine top. Mirrors the web
 * gate's 40+ display allowance (the ramp already covers 48/56 via `ringValue*`;
 * 36 is the web ladder's own top step). Kept as a documented band so a hero
 * readout isn't forced onto a ramp token.
 */
export const DISPLAY_SIZES = [36, 40, 44, 52, 60, 64];

const FONT_SIZE_RE = /\bfontSize\s*:\s*(-?\d+(?:\.\d+)?)\b/g;

/**
 * Read the canonical legal font sizes from `theme.ts` (`Type`) and union in the
 * micro + display bands. Parsed at runtime so the gate always reflects the
 * source of truth — when a `Type.*` role changes size, the gate follows.
 */
export function readLegalSizes(themeSrc = readFileSync(THEME_FILE, "utf8")) {
  const block = themeSrc.match(/export const Type\s*=\s*\{([\s\S]*?)\n\};/);
  if (!block) {
    throw new Error("check:type-scale-mobile — could not find `export const Type` in theme.ts");
  }
  const values = new Set([...MICRO_SIZES, ...DISPLAY_SIZES]);
  const valRe = /fontSize:\s*(\d+(?:\.\d+)?)/g;
  let m;
  while ((m = valRe.exec(block[1])) !== null) {
    values.add(parseFloat(m[1]));
  }
  // The ramp alone must contribute several sizes — guards against a parse that
  // silently matched nothing (which would legalise every literal).
  if (values.size <= MICRO_SIZES.length + DISPLAY_SIZES.length) {
    throw new Error("check:type-scale-mobile — parsed an empty Type ramp from theme.ts");
  }
  return values;
}

export { stripComments };

/**
 * Scan a single source file's text and return its off-ramp findings as
 * `[{ line, value, nearest }]`. Pure (no filesystem) so tests can drive it with
 * synthetic source.
 */
export function findOffScale(src, legal) {
  const code = stripComments(src);
  const lines = code.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    let m;
    FONT_SIZE_RE.lastIndex = 0;
    while ((m = FONT_SIZE_RE.exec(lines[i])) !== null) {
      const value = parseFloat(m[1]);
      if (!legal.has(value)) {
        hits.push({ line: i + 1, value, nearest: nearestLegal(value, legal) });
      }
    }
  }
  return hits;
}

/** Walk the tree and return `{ "<repo-relative path>": [hits] }`. */
export function scanTree(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS, legal = readLegalSizes()) {
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

function printHitLine(h) {
  return `fontSize: ${h.value} → ${h.nearest}`;
}

function main() {
  const legal = readLegalSizes();
  const sortedLegal = [...legal].sort((a, b) => a - b).join(" / ");
  runKeyedCli({
    name: "check:type-scale-mobile",
    budgetFile: BUDGET_FILE,
    scan: () => scanTree(REPO_ROOT, SCAN_DIRS, legal),
    describeHit: printHitLine,
    writeNoun: "off-ramp fontSize literals",
    shedNoun: "off-ramp literals",
    droppedOutLabel: "fully on-ramp",
    okNoun: "legacy off-ramp fontSize literals",
    newHitNoun: (count) => `${count} off-ramp fontSize literal(s)`,
    grewHitNoun: (count) => `${count} off-ramp literal(s)`,
    legalLabel: `Legal ramp: ${sortedLegal}.`,
    guidance:
      `Type comes from the ramp: ${sortedLegal} ` +
      `(use \`Type.*\` from apps/mobile/constants/theme.ts). The gate is a ratchet — it can\n` +
      `only ever tighten. Move the literal onto a \`Type.*\` role, or if you are legitimately\n` +
      `shrinking a pinned file, re-pin it lower with:\n` +
      `  node scripts/check-type-scale-mobile.mjs --write`,
  });
}

if (isInvokedDirectly(import.meta.url)) main();
