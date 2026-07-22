#!/usr/bin/env node

/**
 * ENG-1663 — Anatomy chrome ratchet (only-shrink).
 *
 * Detects screen/feature `.tsx` files that declare container chrome via
 * paired `borderRadius` + `backgroundColor` StyleSheet literals outside
 * owner directories (`components/ui`, `components/suppr`).
 *
 * Baseline: `scripts/anatomy-budget.json`. New/growing files fail CI.
 *
 * Usage:
 *   node scripts/check-anatomy.mjs
 *   node scripts/check-anatomy.mjs --write
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

const BUDGET_FILE = join(REPO_ROOT, "scripts", "anatomy-budget.json");

export const SCAN_DIRS = [
  "apps/mobile/app",
  "apps/mobile/components",
  "src/app",
  "src/app/components",
];

const OWNER_PATH_RE =
  /(^|\/)(components\/ui|app\/components\/ui|app\/components\/suppr|components\/suppr)\//;

const BORDER_RADIUS_RE = /\bborderRadius\s*:/g;
const BACKGROUND_COLOR_RE = /\bbackgroundColor\s*:/g;

export function findAnatomyHits(src) {
  const text = stripComments(src);
  const br = [...text.matchAll(BORDER_RADIUS_RE)];
  const bg = [...text.matchAll(BACKGROUND_COLOR_RE)];
  if (br.length === 0 || bg.length === 0) return [];
  const n = Math.min(br.length, bg.length);
  const hits = [];
  for (let i = 0; i < n; i++) {
    const idx = br[i].index ?? 0;
    const line = text.slice(0, idx).split("\n").length;
    hits.push({ line });
  }
  return hits;
}

export function scanTree(repoRoot = REPO_ROOT, scanDirs = SCAN_DIRS) {
  const byFile = {};
  for (const d of scanDirs) {
    for (const abs of sharedWalk(join(repoRoot, d), [], [".tsx"])) {
      const rel = relative(repoRoot, abs).replaceAll("\\", "/");
      if (OWNER_PATH_RE.test(rel)) continue;
      if (rel.includes("/stories/") || rel.includes(".stories.")) continue;
      if (rel.includes("/__tests__/") || rel.includes(".test.")) continue;
      const hits = findAnatomyHits(readFileSync(abs, "utf8"));
      if (hits.length > 0) byFile[rel] = hits;
    }
  }
  return byFile;
}

function main() {
  runKeyedCli({
    name: "check:anatomy",
    budgetFile: BUDGET_FILE,
    scan: () => scanTree(),
    describeHit: () => "inline borderRadius+backgroundColor chrome outside owners",
    writeNoun: "anatomy chrome sites",
    shedNoun: "anatomy chrome",
    droppedOutLabel: "now anatomy-clean",
    okNoun: "legacy anatomy chrome sites",
    newHitNoun: (count) => `${count} anatomy chrome site(s)`,
    grewHitNoun: (count) => `${count} anatomy chrome site(s)`,
    legalLabel: "Container chrome belongs in owner components under components/ui (or suppr).",
    guidance:
      "Move the chrome into an owner (SupprCard / SupprNotice / SheetShell / …) " +
      "or shrink the pin after a legitimate migration:\n" +
      "  npm run check:anatomy:write",
  });
}

if (isInvokedDirectly(import.meta.url)) main();
