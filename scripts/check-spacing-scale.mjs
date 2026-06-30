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
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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

/** Blank out block + line comments so doc-comment numbers never
 *  false-positive — WHILE preserving line numbers (newlines are kept, comment
 *  bodies become spaces) so the reported `file:line` is accurate. Conservative
 *  on line comments: blanks everything after `//`; this loses the rare case of
 *  `//` inside a string, but spacing props are never written that way. */
export function stripComments(src) {
  // Replace each block comment with the same number of newlines it spanned
  // (plus spaces for the rest), so subsequent line indexing is unchanged.
  let s = src.replace(/\/\*[\s\S]*?\*\//g, (match) =>
    match.replace(/[^\n]/g, " "),
  );
  s = s
    .split("\n")
    .map((line) => {
      const idx = line.indexOf("//");
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join("\n");
  return s;
}

function nearestLegal(value, legal) {
  return [...legal].sort((a, b) => Math.abs(a - value) - Math.abs(b - value))[0];
}

function walk(dir, acc) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".expo") continue;
      walk(full, acc);
    } else if (entry.isFile() && entry.name.endsWith(SCAN_EXT)) {
      acc.push(full);
    }
  }
  return acc;
}

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
    for (const abs of walk(join(repoRoot, d), [])) {
      const hits = findOffScale(readFileSync(abs, "utf8"), legal);
      if (hits.length > 0) byFile[relative(repoRoot, abs)] = hits;
    }
  }
  return byFile;
}

function loadBudget() {
  if (!existsSync(BUDGET_FILE)) return { pins: {}, allow: {} };
  const parsed = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
  return { pins: parsed.pins ?? {}, allow: parsed.allow ?? {} };
}

function writeBudget(pins, allow) {
  const sortedPins = Object.fromEntries(
    Object.entries(pins).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(
    BUDGET_FILE,
    JSON.stringify({ allow, pins: sortedPins }, null, 2) + "\n",
    "utf8",
  );
}

/**
 * Pure evaluator (side-effect-free, exported for tests). Given the per-file
 * findings, the pinned counts, and the allow-list, returns violations +
 * shrink notices + dropped-out pins + any silent (rationale-less) carve-outs.
 */
export function evaluate(byFile, pins, allow = {}) {
  const failures = [];
  const shrinks = [];

  // Silent carve-outs are themselves a failure: an allow entry must explain
  // itself (ENG ref or explicit "intentional" reason).
  const badAllow = [];
  for (const [path, reason] of Object.entries(allow)) {
    if (typeof reason !== "string" || reason.trim().length < 6) {
      badAllow.push(path);
    }
  }

  for (const [path, hits] of Object.entries(byFile)) {
    if (allow[path] !== undefined) continue; // allow-listed (rationale checked above)
    const count = hits.length;
    const pin = pins[path];
    if (pin === undefined) {
      failures.push({ path, count, hits, kind: "new" });
    } else if (count > pin) {
      failures.push({ path, count, pin, hits, kind: "grew" });
    } else if (count < pin) {
      shrinks.push({ path, count, pin });
    }
  }

  // Pins for files that no longer have any off-scale literal can be removed.
  const droppedOut = Object.keys(pins).filter(
    (p) => byFile[p] === undefined && allow[p] === undefined,
  );

  return { failures, shrinks, droppedOut, badAllow };
}

function printHits(hits, indent = "      ") {
  // Show up to 5 hits per file in `file:line current → nearest-legal` form.
  for (const h of hits.slice(0, 5)) {
    console.error(`${indent}${h.line}: ${h.prop}: ${h.value} → ${h.nearest}`);
  }
  if (hits.length > 5) console.error(`${indent}... and ${hits.length - 5} more`);
}

function main() {
  const write = process.argv.includes("--write");
  const legal = readLegalSpacing();
  const byFile = scanTree(REPO_ROOT, SCAN_DIRS, legal);
  const { allow } = loadBudget();

  if (write) {
    const pins = Object.fromEntries(
      Object.entries(byFile)
        .filter(([p]) => allow[p] === undefined)
        .map(([p, hits]) => [p, hits.length]),
    );
    writeBudget(pins, allow);
    const total = Object.values(pins).reduce((a, b) => a + b, 0);
    console.log(
      `[check:spacing-scale] wrote ${Object.keys(pins).length} pinned files ` +
        `(${total} off-scale literals) to ${relative(REPO_ROOT, BUDGET_FILE)}. ` +
        `Legal scale: ${[...legal].sort((a, b) => a - b).join(" / ")}.`,
    );
    return;
  }

  const { pins } = loadBudget();
  const { failures, shrinks, droppedOut, badAllow } = evaluate(byFile, pins, allow);

  if (shrinks.length > 0) {
    console.log("[check:spacing-scale] These files shed off-scale literals — tighten with `--write`:");
    for (const s of shrinks) console.log(`  ${s.path}: ${s.count} (pinned ${s.pin})`);
  }
  if (droppedOut.length > 0) {
    console.log(
      `[check:spacing-scale] ${droppedOut.length} file(s) are now fully on-scale — remove from the pin with \`--write\`:`,
    );
    for (const p of droppedOut) console.log(`  ${p}`);
  }

  if (badAllow.length > 0) {
    console.error(
      `\n[check:spacing-scale] ${badAllow.length} allow-list entr(y/ies) lack a rationale ` +
        `(needs an ENG ref or explicit "intentional ..." reason — no silent carve-outs):`,
    );
    for (const p of badAllow) console.error(`  x ${p}`);
  }

  if (failures.length === 0 && badAllow.length === 0) {
    const total = Object.values(pins).reduce((a, b) => a + b, 0);
    console.log(
      `[check:spacing-scale] OK — ${Object.keys(pins).length} pinned files ` +
        `(${total} legacy off-scale literals), none grew; no new file introduced one. ` +
        `Legal scale: ${[...legal].sort((a, b) => a - b).join(" / ")}.`,
    );
    return;
  }

  if (failures.length > 0) {
    console.error(`\n[check:spacing-scale] ${failures.length} file(s) over budget:\n`);
    for (const f of failures) {
      if (f.kind === "new") {
        console.error(`  x ${f.path} — introduces ${f.count} off-scale spacing literal(s); not pinned:`);
      } else {
        console.error(`  x ${f.path} — grew to ${f.count} off-scale literal(s) (pinned ${f.pin}):`);
      }
      printHits(f.hits);
    }
    console.error(
      `\nSpacing snaps to the scale: ${[...legal].sort((a, b) => a - b).join(" / ")} ` +
        `(use \`Spacing.*\` from apps/mobile/constants/theme.ts). The gate is a ratchet — it can\n` +
        `only ever tighten. Move the literal onto a token, or if you are legitimately shrinking\n` +
        `a pinned file, re-pin it lower with:\n` +
        `  node scripts/check-spacing-scale.mjs --write\n`,
    );
  }
  process.exit(1);
}

const invokedDirectly =
  process.argv[1] && statSync(process.argv[1]).isFile() &&
  fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main();
