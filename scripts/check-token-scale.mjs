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
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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

/** Blank out block + line comments so doc-comment hexes/radii never
 *  false-positive — WHILE preserving line numbers (newlines kept, comment
 *  bodies become spaces) so the reported `file:line` is accurate. */
export function stripComments(src) {
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
    } else if (entry.isFile() && SCAN_EXTS.some((e) => entry.name.endsWith(e))) {
      acc.push(full);
    }
  }
  return acc;
}

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
    for (const abs of walk(join(repoRoot, d), [])) {
      const rel = relative(repoRoot, abs);
      if (TOKEN_DEF_FILES.has(rel)) continue;
      const hits = findViolations(readFileSync(abs, "utf8"), legalRadius);
      if (hits.length > 0) byFile[rel] = hits;
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

/** Pure evaluator — identical contract to the spacing gate. */
export function evaluate(byFile, pins, allow = {}) {
  const failures = [];
  const shrinks = [];

  const badAllow = [];
  for (const [path, reason] of Object.entries(allow)) {
    if (typeof reason !== "string" || reason.trim().length < 6) {
      badAllow.push(path);
    }
  }

  for (const [path, hits] of Object.entries(byFile)) {
    if (allow[path] !== undefined) continue;
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

  const droppedOut = Object.keys(pins).filter(
    (p) => byFile[p] === undefined && allow[p] === undefined,
  );

  return { failures, shrinks, droppedOut, badAllow };
}

function describeHit(h) {
  if (h.kind === "radius") return `borderRadius ${h.token.split(": ")[1]} → ${h.nearest}`;
  if (h.kind === "tailwind") return `${h.token} → semantic token utility`;
  return `${h.token} → semantic token`;
}

function printHits(hits, indent = "      ") {
  for (const h of hits.slice(0, 5)) {
    console.error(`${indent}${h.line}: ${describeHit(h)}`);
  }
  if (hits.length > 5) console.error(`${indent}... and ${hits.length - 5} more`);
}

function main() {
  const write = process.argv.includes("--write");
  const legalRadius = readLegalRadius();
  const byFile = scanTree(REPO_ROOT, SCAN_DIRS, legalRadius);
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
      `[check:token-scale] wrote ${Object.keys(pins).length} pinned files ` +
        `(${total} raw colour/radius literals) to ${relative(REPO_ROOT, BUDGET_FILE)}. ` +
        `Legal radius: ${[...legalRadius].sort((a, b) => a - b).join(" / ")}.`,
    );
    return;
  }

  const { pins } = loadBudget();
  const { failures, shrinks, droppedOut, badAllow } = evaluate(byFile, pins, allow);

  if (shrinks.length > 0) {
    console.log("[check:token-scale] These files shed raw literals — tighten with `--write`:");
    for (const s of shrinks) console.log(`  ${s.path}: ${s.count} (pinned ${s.pin})`);
  }
  if (droppedOut.length > 0) {
    console.log(
      `[check:token-scale] ${droppedOut.length} file(s) are now fully tokenised — remove from the pin with \`--write\`:`,
    );
    for (const p of droppedOut) console.log(`  ${p}`);
  }

  if (badAllow.length > 0) {
    console.error(
      `\n[check:token-scale] ${badAllow.length} allow-list entr(y/ies) lack a rationale ` +
        `(needs an ENG ref or explicit "intentional ..." reason — no silent carve-outs):`,
    );
    for (const p of badAllow) console.error(`  x ${p}`);
  }

  if (failures.length === 0 && badAllow.length === 0) {
    const total = Object.values(pins).reduce((a, b) => a + b, 0);
    console.log(
      `[check:token-scale] OK — ${Object.keys(pins).length} pinned files ` +
        `(${total} legacy raw colour/radius literals), none grew; no new file introduced one. ` +
        `Legal radius: ${[...legalRadius].sort((a, b) => a - b).join(" / ")}.`,
    );
    return;
  }

  if (failures.length > 0) {
    console.error(`\n[check:token-scale] ${failures.length} file(s) over budget:\n`);
    for (const f of failures) {
      if (f.kind === "new") {
        console.error(`  x ${f.path} — introduces ${f.count} raw colour/radius literal(s); not pinned:`);
      } else {
        console.error(`  x ${f.path} — grew to ${f.count} raw literal(s) (pinned ${f.pin}):`);
      }
      printHits(f.hits);
    }
    console.error(
      `\nColour + radius come from tokens: a literal hex / Tailwind palette class is a finding;\n` +
        `borderRadius snaps to ${[...legalRadius].sort((a, b) => a - b).join(" / ")} (\`Radius.*\`).\n` +
        `Route the value to a semantic token (theme.ts / theme.css / the Tailwind theme). The gate\n` +
        `is a ratchet — it can only ever tighten. If you are legitimately shrinking a pinned file,\n` +
        `re-pin it lower with:\n` +
        `  node scripts/check-token-scale.mjs --write\n`,
    );
  }
  process.exit(1);
}

const invokedDirectly =
  process.argv[1] && statSync(process.argv[1]).isFile() &&
  fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) main();
