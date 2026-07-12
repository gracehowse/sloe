#!/usr/bin/env node

/**
 * ENG-536 — Nutrition absolute-claims lint.
 *
 * Scans user-facing source files for banned phrases that make
 * absolute health / nutrition claims. These regress the trust
 * posture documented in `docs/copy/nutrition-claims-guidance.md`.
 *
 * Runs on:
 *   - src/  (web components, lib, context)
 *   - apps/mobile/  (mobile components, app)
 *   - app/  (Next.js App Router pages)
 *
 * Ignores:
 *   - node_modules, .next, dist, test files, docs, scripts
 *   - Code comments (lines starting with // or * after trim)
 *   - Import statements
 *
 * Exit 0 on clean, exit 1 with violation report.
 * Intended for `npm run check:nutrition-claims` and CI.
 */

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

export const BANNED_PHRASES = [
  // Absolute accuracy claims
  "100% accurate",
  "100% precise",
  "guaranteed accurate",
  "exact calories",
  "exact nutrition",
  "exact macros",
  "perfectly accurate",
  "always accurate",
  // Absolute health outcome claims
  "will lose weight",
  "will gain weight",
  "you will weigh",
  "guaranteed to lose",
  "guaranteed to gain",
  "guaranteed weight",
  "cure",
  "cures",
  "prevents disease",
  "prevent disease",
  "treats",
  "heals",
  // ENG-1545 — common non-compliant health / nutrition claims
  "boost metabolism",
  "metabolism boost",
  "fat-burning",
  "burn fat",
  "fat burn",
  "melt fat",
  "torch calories",
  "detox",
  "detoxify",
  // Absolute dietary claims
  "clinically proven",
  "scientifically proven",
  "doctor recommended",
  "medically approved",
];

// Patterns that suppress a banned-phrase hit as a genuine false positive.
// ENG-1545: the old `/cur(e|Empty|rent|sor|ious)/i` alternative matched the
// standalone health claim "cure"/"cures" itself (via the `e` branch), silently
// defeating the ban so "cures bloating" / "cure your cravings" passed. The
// cure-family suppressors below now require a LETTER immediately before "cure"
// (secure, procure, obscure, manicure, …) so a word-initial "cure"/"cures"
// still fires; the `cur(…)` list covers the "cur"-but-not-"cure" words
// (current, cursor, curious, curated/accurate, curb, curl) that never contain
// the banned substring anyway.
const FALSE_POSITIVE_PATTERNS = [
  // Charcuterie / food-context "cured" — not a health claim. Both word orders
  // ("cured pork" and a "<meat> cured" food alias, e.g. "pancetta pork cured").
  /cured?\s+(ham|pork|meat|bacon|fish|salmon|sausage|olives?|egg)/i,
  /(?:ham|pork|meat|bacon|fish|salmon|beef|pancetta|prosciutto|salami|chorizo|coppa|guanciale)\s+cured\b/i,
  /lime[- ]cured/i,
  // "cure"/"cures" only as a substring of an unrelated word (leading letter):
  // secure, procure, obscure, manicure, pedicure, epicure (+ inflections).
  /[a-z]cures?/i,
  // "cur"-family words that never contain the banned "cure"/"cures" substring
  // (current, cursor, curious, curated/accurate, curb, curl, curd, curEmpty).
  /cur(rent|sor|ious|ated?|b|l|ve|ds?\b|empty)/i,
  // FDA-style supplement disclaimer ("not intended to diagnose, treat, cure,
  // or prevent any disease") — approved compliance copy, not a claim.
  /do not use.*cure/i,
  /diagnose.*treat.*cure/i,
  /not intended to.*(diagnose|treat|cure)/i,
  // camelCase identifiers that merely start with "treat" (e.g.
  // `treatServingAsTruth`) — code, not the health claim "treats <condition>".
  // A real claim is lowercase ("treats bloating"), so requiring an uppercase
  // letter right after "treat" leaves the ban intact.
  /treat[A-Z]/,
  // The word "detox"/"detoxify" written as a regex literal (`\bdetox\b`) — the
  // coach/narrative modules' OWN guardrails that DETECT detox talk, not copy
  // making a detox claim. Requires the regex word-boundary escape, so a plain
  // "detox" in user-facing copy still fires.
  /\\bdetox/i,
  // Fasting metabolic-stage descriptor "fat burning" (the space gerund) — the
  // physiological lipolysis phase in the fasting timer, standard domain
  // terminology (Fed → Fat burning → Ketosis), not a marketing claim. This
  // excuses ONLY the exact gerund; the marketing-claim forms "fat-burning"
  // (hyphen), "burn fat", "melt fat" and "torch calories" still fire. ENG-1545
  // — see report; legal to confirm the user-facing stage label wording.
  /fat burning/i,
];

const SCAN_DIRS = ["src", "apps/mobile/app", "apps/mobile/components", "apps/mobile/lib", "app"];
const EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const IGNORE_DIRS = new Set(["node_modules", ".next", "dist", "__tests__", "tests", "test"]);

function walk(dir) {
  const files = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      if (!entry.name.includes(".test.") && !entry.name.includes(".spec.")) {
        files.push(full);
      }
    }
  }
  return files;
}

function isCommentOrImport(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    // JSX comments `{/* … */}` are comments too, not user-facing copy (ENG-1545).
    trimmed.startsWith("{/*") ||
    trimmed.startsWith("import ") ||
    trimmed.startsWith("import{")
  );
}

/**
 * True when some false-positive pattern matches a span of `line` that OVERLAPS
 * the [start, end) range of a banned-phrase occurrence. ENG-1545: the old
 * checker suppressed a whole line if ANY FP matched anywhere on it, so one
 * innocent word (e.g. "secure") disabled claim detection for an unrelated real
 * claim on the same line ("burn fat"). Scoping the suppressor to the actual
 * match span keeps each FP tied to the word it excuses.
 */
function suppressedByFalsePositive(line, start, end) {
  for (const rx of FALSE_POSITIVE_PATTERNS) {
    const flags = rx.flags.includes("g") ? rx.flags : `${rx.flags}g`;
    const g = new RegExp(rx.source, flags);
    let m;
    while ((m = g.exec(line)) !== null) {
      const s = m.index;
      const e = m.index + m[0].length;
      if (s < end && start < e) return true; // spans overlap
      if (m.index === g.lastIndex) g.lastIndex++; // guard zero-length matches
    }
  }
  return false;
}

/**
 * Core matcher — scan a block of source text for banned health/nutrition
 * claims, honouring the comment/import skip and the (span-scoped) false-positive
 * suppressors. Exported so the checker can be unit-tested against fixture
 * strings without touching the filesystem (ENG-1545). Returns one entry per
 * violation occurrence.
 */
export function findClaimViolationsInText(text) {
  const found = [];
  const lines = String(text).split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isCommentOrImport(line)) continue;
    const lower = line.toLowerCase();
    for (const phrase of BANNED_PHRASES) {
      const needle = phrase.toLowerCase();
      let from = 0;
      let idx;
      while ((idx = lower.indexOf(needle, from)) !== -1) {
        const end = idx + needle.length;
        if (!suppressedByFalsePositive(line, idx, end)) {
          found.push({ line: i + 1, phrase, context: line.trim().slice(0, 120) });
        }
        from = end;
      }
    }
  }
  return found;
}

function runCli() {
  let violations = 0;
  const report = [];

  for (const scanDir of SCAN_DIRS) {
    for (const file of walk(scanDir)) {
      const content = readFileSync(file, "utf8");
      for (const hit of findClaimViolationsInText(content)) {
        violations++;
        report.push({ file: relative(process.cwd(), file), ...hit });
      }
    }
  }

  if (violations === 0) {
    console.log("✓ No absolute nutrition/health claims found in user-facing code.");
    process.exit(0);
  }

  console.log(`\n⚠ ${violations} absolute nutrition/health claim(s) found:\n`);
  for (const v of report) {
    console.log(`  ${v.file}:${v.line}`);
    console.log(`    Banned phrase: "${v.phrase}"`);
    console.log(`    Context: ${v.context}`);
    console.log();
  }

  console.log("See docs/copy/nutrition-claims-guidance.md for approved alternatives.");
  process.exit(1);
}

// Run the filesystem scan only when invoked directly (npm run check /
// CI), not when imported by a test.
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectRun) {
  runCli();
}
