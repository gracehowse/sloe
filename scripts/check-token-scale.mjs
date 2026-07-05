#!/usr/bin/env node

/**
 * ENG-1007 — Colour / radius token census + only-shrink ratchet (web + mobile).
 *
 * Gives teeth to the "Tokens only — no literal hexes, no off-scale radii"
 * rule (root `.claude/CLAUDE.md` UI write discipline + `_project-context.md`
 * Design craft contract: "A literal hex in a component is a finding").
 * Like the spacing gate, the rule lived only in review agents; this script
 * is the write-time / CI gate.
 *
 * What it flags (a "token-scale violation"):
 *   1. A raw 6-digit hex literal `#RRGGBB` in a component (web or mobile).
 *   2. A raw Tailwind palette colour class `bg-/text-/border-<hue>-<NNN>`
 *      (web), e.g. `bg-red-500`, `text-slate-600` — should be a semantic
 *      token utility, not a raw palette step.
 *   3. A `borderRadius` numeric literal that is not on the canonical `Radius`
 *      scale (mobile), read at runtime from `apps/mobile/constants/theme.ts`
 *      (`Radius` = 4/6/8/12/9999) — never hardcoded.
 *
 * Exclusions: token-definition files (`apps/mobile/constants/theme.ts`,
 * `src/styles/theme.css`, the Tailwind theme config), `node_modules`, and
 * `.claude/worktrees` (agent worktrees mirror the tree and would
 * double-count). 3-digit hexes (`#000` / `#fff`) are NOT matched — the Apple
 * Sign-In brand carve-out (`signup.tsx`, `login.tsx`) writes those, and they
 * are a documented intentional divergence (`_project-context.md`).
 *
 * Comments are stripped before scanning, so a hex referenced in a doc
 * comment ("light #3B2A4D / dark #815E91") never reads as a violation.
 *
 * Ratchet model (same as `check-screen-line-budget.mjs`):
 *   - The current violation population is pinned PER FILE in
 *     `scripts/token-budget.json` (`{ pins: { "<path>": <count> }, allow:
 *     { "<path>": "<rationale / ENG-ref>" } }`). A pinned file may only
 *     SHRINK; introducing a violation in an un-pinned file fails CI.
 *   - `allow` entries are full-file carve-outs and MUST carry a non-empty
 *     rationale (ENG ref / explicit "intentional" reason) — a silent
 *     carve-out is itself a failure.
 *
 * Usage:
 *   node scripts/check-token-scale.mjs            # check (CI)
 *   node scripts/check-token-scale.mjs --write    # regenerate pins
 *
 * Exit 0 on clean, exit 1 with a `file:line current → nearest-legal`
 * report otherwise. Wired into `npm run check:token-scale` and CI.
 *
 * The `stripComments`/`walk`/`loadBudget`/`writeBudget`/`evaluate`/CLI
 * scaffolding is shared with the spacing, type-scale-mobile, and
 * screen-line-budget gates — see `scripts/lib/ratchet.mjs` (ENG-1363).
 * Only the token-specific regex + theme parsing lives here.
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

const BUDGET_FILE = join(REPO_ROOT, "scripts", "token-budget.json");
const THEME_FILE = join(REPO_ROOT, "apps", "mobile", "constants", "theme.ts");

/** Dirs the token rule targets (relative to repo root). Web + mobile, same
 *  surfaces as the screen-line ratchet. */
export const SCAN_DIRS = [
  "src/app/components",
  "app",
  "apps/mobile/app",
  "apps/mobile/components",
];

const SCAN_EXTS = [".tsx", ".ts"];

/** Token-definition files — the legal homes for raw values. Repo-relative. */
const TOKEN_DEF_FILES = new Set([
  "apps/mobile/constants/theme.ts",
  "src/styles/theme.css",
  "tailwind.config.ts",
  "tailwind.config.js",
]);

const HEX_RE = /#[0-9a-fA-F]{6}\b/g;
// Tailwind palette colour class: bg-/text-/border- + hue + 3-digit step.
// Constrained to the canonical Tailwind hue names so e.g. `text-2xl` or a
// `bg-[#fff]` arbitrary value (caught by HEX_RE) never matches here.
const TW_HUES =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone";
const TW_RE = new RegExp(`\\b(?:bg|text|border)-(?:${TW_HUES})-[0-9]{3}\\b`, "g");
const RADIUS_RE = /\bborderRadius\s*:\s*(\d+(?:\.\d+)?)\b/g;

/** Read the canonical legal radius values from `theme.ts` (`Radius`). */
export function readLegalRadius(themeSrc = readFileSync(THEME_FILE, "utf8")) {
  const block = themeSrc.match(/export const Radius\s*=\s*\{([\s\S]*?)\}/);
  if (!block) {
    throw new Error("check:token-scale — could not find `export const Radius` in theme.ts");
  }
  const values = new Set([0]); // 0 = square, always legal
  const valRe = /:\s*(\d+(?:\.\d+)?)\s*,/g;
  let m;
  while ((m = valRe.exec(block[1])) !== null) {
    values.add(parseFloat(m[1]));
  }
  if (values.size <= 1) {
    throw new Error("check:token-scale — parsed an empty Radius scale from theme.ts");
  }
  return values;
}

export { stripComments };

/**
 * Scan a single source file's text and return its token findings as
 * `[{ line, kind, token, nearest? }]`. Pure (no filesystem) so tests can
 * drive it with synthetic source.
 *   kind: "hex" | "tailwind" | "radius"
 */
export function findViolations(src, legalRadius) {
  const code = stripComments(src);
  const lines = code.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    HEX_RE.lastIndex = 0;
    while ((m = HEX_RE.exec(line)) !== null) {
      hits.push({ line: i + 1, kind: "hex", token: m[0] });
    }
    TW_RE.lastIndex = 0;
    while ((m = TW_RE.exec(line)) !== null) {
      hits.push({ line: i + 1, kind: "tailwind", token: m[0] });
    }
    RADIUS_RE.lastIndex = 0;
    while ((m = RADIUS_RE.exec(line)) !== null) {
      const value = parseFloat(m[1]);
      if (!legalRadius.has(value)) {
        hits.push({
          line: i + 1,
          kind: "radius",
          token: `borderRadius: ${value}`,
          nearest: nearestLegal(value, legalRadius),
        });
      }
    }
  }
  return hits;
}

/** Walk the tree and return `{ "<repo-relative path>": [hits] }`. */
export function scanTree(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS, legalRadius = readLegalRadius()) {
  const byFile = {};
  for (const d of scanDirs) {
    for (const abs of sharedWalk(join(repoRoot, d), [], SCAN_EXTS)) {
      const rel = relative(repoRoot, abs);
      if (TOKEN_DEF_FILES.has(rel)) continue;
      const hits = findViolations(readFileSync(abs, "utf8"), legalRadius);
      if (hits.length > 0) byFile[rel] = hits;
    }
  }
  return byFile;
}

export { evaluate };

function describeHit(h) {
  if (h.kind === "radius") return `borderRadius ${h.token.split(": ")[1]} → ${h.nearest}`;
  if (h.kind === "tailwind") return `${h.token} → semantic token utility`;
  return `${h.token} → semantic token`;
}

function main() {
  const legalRadius = readLegalRadius();
  const sortedRadius = [...legalRadius].sort((a, b) => a - b).join(" / ");
  runKeyedCli({
    name: "check:token-scale",
    budgetFile: BUDGET_FILE,
    scan: () => scanTree(REPO_ROOT, SCAN_DIRS, legalRadius),
    describeHit,
    writeNoun: "raw colour/radius literals",
    shedNoun: "raw literals",
    droppedOutLabel: "fully tokenised",
    okNoun: "legacy raw colour/radius literals",
    newHitNoun: (count) => `${count} raw colour/radius literal(s)`,
    grewHitNoun: (count) => `${count} raw literal(s)`,
    legalLabel: `Legal radius: ${sortedRadius}.`,
    guidance:
      `Colour + radius come from tokens: a literal hex / Tailwind palette class is a finding;\n` +
      `borderRadius snaps to ${sortedRadius} (\`Radius.*\`).\n` +
      `Route the value to a semantic token (theme.ts / theme.css / the Tailwind theme). The gate\n` +
      `is a ratchet — it can only ever tighten. If you are legitimately shrinking a pinned file,\n` +
      `re-pin it lower with:\n` +
      `  node scripts/check-token-scale.mjs --write`,
  });
}

if (isInvokedDirectly(import.meta.url)) main();
