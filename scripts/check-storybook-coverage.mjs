#!/usr/bin/env node
/**
 * Storybook sibling-story coverage ratchet (ENG-1662 / Chromatic gate).
 *
 * Every visual `.tsx` under the scanned roots must have a sibling
 * `*.stories.tsx` (same basename, or kebab-case equivalent), OR an explicit
 * entry in `scripts/storybook-coverage-skips.json`.
 *
 * Owner dirs (`ui/` web+mobile, `suppr/`) are always enforced. Feature
 * components are included so new files cannot land without a story or skip.
 *
 * Usage:
 *   node scripts/check-storybook-coverage.mjs
 *   node scripts/check-storybook-coverage.mjs --write-skips   # dump current missing as JSON skeleton (does not merge reasons)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIPS_FILE = path.join(REPO_ROOT, "scripts", "storybook-coverage-skips.json");

/** Roots relative to repo — visual component inventory. */
const SCAN_ROOTS = [
  "src/app/components/ui",
  "src/app/components/suppr",
  "src/app/components",
  "apps/mobile/components/ui",
  "apps/mobile/components",
];

function isHookFile(name) {
  return /^use[A-Z]/.test(name) || name.startsWith("use-");
}

function walkVisual(dirAbs, acc = []) {
  if (!fs.existsSync(dirAbs)) return acc;
  for (const e of fs.readdirSync(dirAbs, { withFileTypes: true })) {
    const p = path.join(dirAbs, e.name);
    if (e.isDirectory()) {
      walkVisual(p, acc);
      continue;
    }
    if (!e.name.endsWith(".tsx")) continue;
    if (e.name.includes(".stories.")) continue;
    if (e.name.includes(".test.")) continue;
    if (e.name.startsWith("_")) continue;
    if (isHookFile(e.name)) continue;
    acc.push(p);
  }
  return acc;
}

function norm(s) {
  return s.replace(/[-_]/g, "").toLowerCase();
}

function hasSiblingStory(fileAbs) {
  const dir = path.dirname(fileAbs);
  const stem = path.basename(fileAbs, ".tsx");
  const kebab = stem.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  const candidates = [
    path.join(dir, `${stem}.stories.tsx`),
    path.join(dir, `${kebab}.stories.tsx`),
    path.join(dir, `${stem.toLowerCase()}.stories.tsx`),
  ];
  if (candidates.some((c) => fs.existsSync(c))) return true;
  const target = norm(stem);
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith(".stories.tsx"))
    .some((n) => norm(n.replace(/\.stories\.tsx$/, "")) === target);
}

function loadSkips() {
  const raw = JSON.parse(fs.readFileSync(SKIPS_FILE, "utf8"));
  const set = new Set();
  for (const [area, entries] of Object.entries(raw.skips ?? {})) {
    for (const row of entries) {
      const rel = typeof row === "string" ? row : row.file;
      set.add(rel.replace(/\\/g, "/"));
    }
  }
  return { raw, set };
}

function collectUniqueVisuals() {
  const seen = new Set();
  const files = [];
  for (const root of SCAN_ROOTS) {
    const abs = path.join(REPO_ROOT, root);
    for (const f of walkVisual(abs)) {
      const rel = path.relative(REPO_ROOT, f).replace(/\\/g, "/");
      if (seen.has(rel)) continue;
      seen.add(rel);
      files.push(rel);
    }
  }
  return files;
}

function main() {
  const writeSkips = process.argv.includes("--write-skips");
  const { set: skipSet } = loadSkips();
  const visuals = collectUniqueVisuals();
  const missing = [];

  for (const rel of visuals) {
    if (skipSet.has(rel)) continue;
    const abs = path.join(REPO_ROOT, rel);
    if (!hasSiblingStory(abs)) missing.push(rel);
  }

  // Orphan skips (file gone) — warn only
  const orphanSkips = [...skipSet].filter(
    (rel) => !fs.existsSync(path.join(REPO_ROOT, rel)),
  );

  if (writeSkips) {
    console.log(JSON.stringify({ missing, orphanSkips }, null, 2));
    process.exit(0);
  }

  if (orphanSkips.length) {
    console.warn(
      `[check-storybook-coverage] ${orphanSkips.length} skip entries point at missing files (clean up skips JSON):`,
    );
    for (const o of orphanSkips.slice(0, 20)) console.warn(`  ${o}`);
  }

  if (missing.length) {
    console.error(
      `[check-storybook-coverage] ${missing.length} visual component(s) lack a sibling *.stories.tsx and are not in scripts/storybook-coverage-skips.json:\n`,
    );
    for (const m of missing) console.error(`  ${m}`);
    console.error(
      `\nAdd a story beside the file, or an explicit skip row in ${path.relative(REPO_ROOT, SKIPS_FILE)}.`,
    );
    process.exit(1);
  }

  const covered = visuals.length - [...skipSet].filter((s) => visuals.includes(s) || skipSet.has(s)).length;
  // clearer summary:
  const skippedPresent = [...skipSet].filter((s) =>
    fs.existsSync(path.join(REPO_ROOT, s)),
  ).length;
  console.log(
    `[check-storybook-coverage] OK — ${visuals.length} visual files; ${skippedPresent} explicit skips; ${visuals.length - skippedPresent} require+have stories.`,
  );
}

main();
