#!/usr/bin/env node

/**
 * ENG-1592 — Web spacing-scale census + only-shrink ratchet (the web leg
 * ENG-1007's own code comment promised and never built — mobile's
 * `check-spacing-scale.mjs` scans `apps/mobile/app` + `apps/mobile/components`
 * ONLY, so web page gutters / section gaps / padding-margin-gap literals had
 * zero CI enforcement until now).
 *
 * What it flags (a "web-spacing violation"), in web `.tsx`:
 *   1. An arbitrary bracket value on a padding/margin/gap Tailwind utility —
 *      `p-[Npx]`, `mt-[Npx]`, `gap-x-[Npx]`, etc. (any directional variant) —
 *      whose N is NOT on the legal 4/8/12/16/20/24/32/40 scale.
 *   2. An off-scale NUMERIC Tailwind spacing step on the same utility family
 *      — `p-7`, `mb-9`, `gap-11`, etc. Tailwind's default spacing scale is
 *      `step * 0.25rem` (`step * 4px`); the legal scale is exactly the steps
 *      whose px value lands on 4/8/12/16/20/24/32/40 (steps 1/2/3/4/5/6/8/10).
 *      `p-6` (24px, step 6) is legal; `p-7` (28px, step 7) is not — this is
 *      the ENG-1592 census's own worked example.
 *   Utility family scanned: `p*` / `m*` / `gap*` (padding, margin, gap and
 *   all directional variants: x/y/t/b/l/r/s/e for padding+margin,
 *   x/y for gap) — the exact families ENG-1592 scoped this gate to. Other
 *   Tailwind spacing-shaped utilities (`space-y-*`, `inset-*`, `top-*`, …)
 *   are a different, broader problem (cluster 14's "section-gap mechanism"
 *   finding) and are deliberately OUT of scope for this gate.
 *
 *   Custom `*-pm-N` token classes (`px-pm-6`, the repo's own semantic
 *   spacing scale — see `--spacing-pm-*` in `src/styles/theme.css`) are
 *   NEVER matched: the numeric-step regex requires digits immediately after
 *   the prop's `-`, and `pm-6` starts with the letter `p`, not a digit — so
 *   a token reference reads as "not a raw literal" the same way mobile's
 *   gate treats a `Spacing.*` reference as clean.
 *
 * A negative Tailwind utility (`-mt-8`, `-mx-[12px]`) is scored on its
 * signed px value; since the legal scale is all-positive (mirroring
 * mobile's `check-spacing-scale.mjs`, which has the same property), any
 * negative spacing literal is off-scale by construction — same behaviour,
 * not a new special case.
 *
 * Scope: `src/app` + `app` (repo root) `.tsx` only — the same web-only dirs
 * `check-web-radius.mjs` (ENG-1499) scans. Mobile spacing is gated
 * separately by `check-spacing-scale.mjs` (RN/StyleSheet numeric literals,
 * a different syntax entirely).
 *
 * Comments are stripped before scanning, so a px value referenced in a doc
 * comment never reads as a violation.
 *
 * Ratchet model (same as the other `lib/ratchet.mjs` consumers):
 *   - The current off-scale population is pinned PER FILE in
 *     `scripts/web-spacing-budget.json` (`{ pins: { "<path>": <count> },
 *     allow: { "<path>": "<rationale / ENG-ref>" } }`). A pinned file may
 *     only SHRINK — adding an off-scale literal fails CI.
 *   - Any file NOT pinned that introduces an off-scale literal fails CI.
 *   - `allow` entries are full-file carve-outs and MUST carry a non-empty
 *     rationale (ENG ref / explicit "intentional" reason) — a silent
 *     carve-out is itself a failure.
 *
 * Usage:
 *   node scripts/check-web-spacing-scale.mjs            # check (CI)
 *   node scripts/check-web-spacing-scale.mjs --write    # regenerate pins
 *
 * Exit 0 on clean, exit 1 with a `file:line current → nearest-legal` report
 * otherwise. Wired into `npm run check:web-spacing-scale` and CI.
 *
 * The `stripComments`/`walk`/`loadBudget`/`writeBudget`/`evaluate`/CLI
 * scaffolding is shared with the spacing (mobile), token, type-scale-mobile,
 * screen-line-budget, and web-radius gates — see `scripts/lib/ratchet.mjs`
 * (ENG-1363). Only the web-spacing-specific regex lives here.
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
import { readLegalSpacing } from "./check-spacing-scale.mjs";

const BUDGET_FILE = join(REPO_ROOT, "scripts", "web-spacing-budget.json");

/** Web surfaces only — the same dirs `check-web-radius.mjs` (ENG-1499)
 *  scans. Mobile spacing is gated separately by `check-spacing-scale.mjs`. */
export const SCAN_DIRS = ["src/app", "app"];

const SCAN_EXT = ".tsx";

/** `p*` / `m*` / `gap*` Tailwind spacing families, longest-prefix-first so
 *  the regex alternation never lets a short alias (`p`, `gap`) shadow a
 *  longer one (`px`, `gap-x`) it happens to be a prefix of. */
const SPACING_PREFIXES = [
  "gap-x",
  "gap-y",
  "gap",
  "px",
  "py",
  "pt",
  "pb",
  "pl",
  "pr",
  "ps",
  "pe",
  "mx",
  "my",
  "mt",
  "mb",
  "ml",
  "mr",
  "ms",
  "me",
  "p",
  "m",
];

const PREFIX_ALT = SPACING_PREFIXES.join("|");

/** `p-[14px]`, `-mt-[8px]`, `gap-x-[10px]`, `mt-[-8px]` — an arbitrary
 *  bracket value on a spacing utility. Captures: (1) optional outer minus
 *  (the `-mt-…` negative-utility prefix), (2) prop, (3) optional inner
 *  minus (a signed value inside the brackets, `mt-[-8px]`), (4) magnitude. */
const ARBITRARY_RE = new RegExp(
  `(-)?\\b(${PREFIX_ALT})-\\[(-?)(\\d+(?:\\.\\d+)?)px\\]`,
  "g",
);

/** `p-7`, `-mb-9`, `gap-x-11` — a numeric Tailwind spacing step. Never
 *  collides with the bracket form above: the character immediately after
 *  the prop's `-` would be `[`, not a digit, so `-(\d+...)` fails to match
 *  bracket classes at all. Token references like `px-pm-6` are excluded the
 *  same way — `pm-6` starts with a letter, not a digit. */
const NUMERIC_RE = new RegExp(`(-)?\\b(${PREFIX_ALT})-(\\d+(?:\\.\\d+)?)\\b`, "g");

export { stripComments, readLegalSpacing };

/**
 * Scan a single source file's text and return its off-scale findings as
 * `[{ line, prop, value, nearest }]`. Pure (no filesystem) so tests can
 * drive it with synthetic source. `value` is the resolved signed px value
 * (arbitrary: the literal px; numeric: step * 4).
 */
export function findOffScale(src, legal) {
  const code = stripComments(src);
  const lines = code.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    ARBITRARY_RE.lastIndex = 0;
    let m;
    while ((m = ARBITRARY_RE.exec(line)) !== null) {
      const [, outerNeg, prop, innerNeg, magnitude] = m;
      const negative = Boolean(outerNeg) !== Boolean(innerNeg); // XOR — both signs cancel out
      const value = (negative ? -1 : 1) * parseFloat(magnitude);
      if (!legal.has(value)) {
        hits.push({ line: i + 1, prop, value, nearest: nearestLegal(value, legal) });
      }
    }

    NUMERIC_RE.lastIndex = 0;
    while ((m = NUMERIC_RE.exec(line)) !== null) {
      const [, outerNeg, prop, step] = m;
      const magnitudePx = parseFloat(step) * 4;
      const value = outerNeg ? -magnitudePx : magnitudePx;
      if (!legal.has(value)) {
        hits.push({ line: i + 1, prop, value, nearest: nearestLegal(value, legal) });
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
  return `${h.prop}: ${h.value}px → ${h.nearest}px`;
}

function main() {
  const legal = readLegalSpacing();
  const sortedLegal = [...legal].sort((a, b) => a - b).join(" / ");
  runKeyedCli({
    name: "check:web-spacing-scale",
    budgetFile: BUDGET_FILE,
    scan: () => scanTree(REPO_ROOT, SCAN_DIRS, legal),
    describeHit,
    writeNoun: "off-scale web spacing literals",
    shedNoun: "off-scale literals",
    droppedOutLabel: "fully on-scale",
    okNoun: "legacy off-scale web spacing literals",
    newHitNoun: (count) => `${count} off-scale spacing literal(s)`,
    grewHitNoun: (count) => `${count} off-scale literal(s)`,
    legalLabel: `Legal scale: ${sortedLegal}.`,
    guidance:
      `Spacing snaps to the scale: ${sortedLegal} ` +
      `(use the \`*-pm-N\` semantic classes / \`space-*\` tokens in src/styles/theme.css, or a\n` +
      `legal numeric Tailwind step). The gate is a ratchet — it can only ever tighten. Move the\n` +
      `literal onto a legal value, or if you are legitimately shrinking a pinned file, re-pin it\n` +
      `lower with:\n` +
      `  node scripts/check-web-spacing-scale.mjs --write`,
  });
}

if (isInvokedDirectly(import.meta.url)) main();
