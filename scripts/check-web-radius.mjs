#!/usr/bin/env node

/**
 * ENG-1499 — Web `rounded-*` radius census + only-shrink ratchet.
 *
 * The 2026-07-10 card-grammar ruling
 * (`docs/decisions/2026-07-10-card-grammar-rounder-flat.md`) sets ONE card
 * corner (24px, `rounded-card` / `rounded-card-lg`) and a 12px inner
 * standard (the 12-inside-24 concentric inset). The census found the web
 * `rounded-*` namespace entirely ungated — ~9 distinct radius values lived
 * on card-like elements. This is the write-time / CI gate that stops new
 * off-grammar radii landing.
 *
 * What it flags (a "web-radius violation"):
 *   1. An arbitrary `rounded-[Npx]` value (any directional variant, e.g.
 *      `rounded-t-[24px]`) whose N is NOT in the legal px set {12, 24}
 *      (12 = inner standard, 24 = the card corner — both on the canonical
 *      snap scale 4/6/8/12/24/full; the sub-12 chrome steps route through
 *      the NAMED classes below, never arbitrary px).
 *   2. The retired named classes `rounded-2xl` (16px — the retired
 *      "secondary card" tier) and `rounded-3xl` (24px spelled off-token),
 *      including directional variants like `rounded-t-2xl`. Cards use
 *      `rounded-card` / `rounded-card-lg`; 24px must be spelled ONE way.
 *
 * Allowlisted (NOT gated): the token-mapped named classes `rounded-card`,
 * `rounded-card-lg`, `rounded-sm/md/lg/xl`, `rounded-full`, `rounded-none`
 * (`rounded-xl` = 10px chrome stays legal until a later slice), and
 * `rounded-[var(--…)]` token-routed arbitrary values.
 *
 * Ratchet model (same as `check-token-scale.mjs`): the current violation
 * population is pinned PER FILE in `scripts/web-radius-budget.json`
 * (`{ pins, allow }`). A pinned file may only SHRINK; a violation in an
 * un-pinned file fails CI. `allow` entries MUST carry a rationale.
 *
 * Usage:
 *   node scripts/check-web-radius.mjs            # check (CI)
 *   node scripts/check-web-radius.mjs --write    # regenerate pins
 *
 * Wired into `npm run check:web-radius` and `npm run ci`.
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

const BUDGET_FILE = join(REPO_ROOT, "scripts", "web-radius-budget.json");

/** Web surfaces only — mobile radii are gated by `check:token-scale`. */
export const SCAN_DIRS = ["src/app", "app"];

const SCAN_EXTS = [".tsx"];

/** Legal arbitrary px values: 24 = THE card corner (`--radius-card-lg`),
 *  12 = the nested/inner standard (12-inside-24 concentric). Everything
 *  else must come from a named token class. Decision:
 *  docs/decisions/2026-07-10-card-grammar-rounder-flat.md */
export const LEGAL_ARBITRARY_PX = new Set([12, 24]);

// Directional variant segment shared by both patterns (rounded-t-, -tl-, …).
const DIR = "(?:(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee)-)?";
// Arbitrary px value, e.g. rounded-[14px], rounded-t-[24px].
const ARBITRARY_PX_RE = new RegExp(`\\brounded-${DIR}\\[(\\d+(?:\\.\\d+)?)px\\]`, "g");
// Retired named tiers, e.g. rounded-2xl, sm:rounded-3xl, rounded-t-2xl.
const RETIRED_CLASS_RE = new RegExp(`\\brounded-${DIR}(?:2xl|3xl)\\b`, "g");

/**
 * Scan one file's text → `[{ line, kind, token, nearest? }]`.
 * Pure (no filesystem) so tests can drive it with synthetic source.
 *   kind: "arbitrary-px" | "retired-class"
 */
export function findViolations(src, legalPx = LEGAL_ARBITRARY_PX) {
  const code = stripComments(src);
  const lines = code.split("\n");
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    ARBITRARY_PX_RE.lastIndex = 0;
    while ((m = ARBITRARY_PX_RE.exec(line)) !== null) {
      const value = parseFloat(m[1]);
      if (!legalPx.has(value)) {
        hits.push({
          line: i + 1,
          kind: "arbitrary-px",
          token: m[0],
          nearest: nearestLegal(value, legalPx),
        });
      }
    }
    RETIRED_CLASS_RE.lastIndex = 0;
    while ((m = RETIRED_CLASS_RE.exec(line)) !== null) {
      hits.push({ line: i + 1, kind: "retired-class", token: m[0] });
    }
  }
  return hits;
}

/** Walk the tree and return `{ "<repo-relative path>": [hits] }`. */
export function scanTree(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS, legalPx = LEGAL_ARBITRARY_PX) {
  const byFile = {};
  for (const d of scanDirs) {
    for (const abs of sharedWalk(join(repoRoot, d), [], SCAN_EXTS)) {
      const rel = relative(repoRoot, abs);
      const hits = findViolations(readFileSync(abs, "utf8"), legalPx);
      if (hits.length > 0) byFile[rel] = hits;
    }
  }
  return byFile;
}

export { evaluate, stripComments };

function describeHit(h) {
  if (h.kind === "arbitrary-px") return `${h.token} → ${h.nearest}px (or a token class)`;
  return `${h.token} → rounded-card-lg (cards) / rounded-[12px] (inner)`;
}

function main() {
  const sortedPx = [...LEGAL_ARBITRARY_PX].sort((a, b) => a - b).join(" / ");
  runKeyedCli({
    name: "check:web-radius",
    budgetFile: BUDGET_FILE,
    scan: () => scanTree(),
    describeHit,
    writeNoun: "off-grammar web radii",
    shedNoun: "off-grammar radii",
    droppedOutLabel: "fully on the card grammar",
    okNoun: "legacy off-grammar web radii",
    newHitNoun: (count) => `${count} off-grammar radius/radii`,
    grewHitNoun: (count) => `${count} off-grammar radius/radii`,
    legalLabel: `Legal arbitrary px: ${sortedPx}. Cards: rounded-card / rounded-card-lg (24).`,
    guidance:
      `Web corners follow the one card grammar (2026-07-10): cards/banners/sheets/tiles are 24\n` +
      `(\`rounded-card\` / \`rounded-card-lg\`), nested/inner elements are 12; \`rounded-2xl\` /\n` +
      `\`rounded-3xl\` and arbitrary \`rounded-[Npx]\` off {${sortedPx}} are retired. The gate is a\n` +
      `ratchet — it can only ever tighten. If you legitimately shrank a pinned file, re-pin with:\n` +
      `  node scripts/check-web-radius.mjs --write`,
  });
}

if (isInvokedDirectly(import.meta.url)) main();
