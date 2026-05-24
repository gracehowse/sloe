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
import { join, relative } from "node:path";

const BANNED_PHRASES = [
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
  // Absolute dietary claims
  "clinically proven",
  "scientifically proven",
  "doctor recommended",
  "medically approved",
];

const FALSE_POSITIVE_PATTERNS = [
  /cured?\s+(ham|pork|meat|bacon|fish|salmon)/i,
  /lime[- ]cured/i,
  /secure[_a-z]/i,
  /cur(e|Empty|rent|sor|ious)/i,
  /do not use.*cure/i,
  /diagnose.*treat.*cure/i,
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
    trimmed.startsWith("import ") ||
    trimmed.startsWith("import{")
  );
}

let violations = 0;
const report = [];

for (const scanDir of SCAN_DIRS) {
  for (const file of walk(scanDir)) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (isCommentOrImport(lines[i])) continue;
      const lower = lines[i].toLowerCase();
      for (const phrase of BANNED_PHRASES) {
        if (lower.includes(phrase.toLowerCase())) {
          const isFP = FALSE_POSITIVE_PATTERNS.some((rx) => rx.test(lines[i]));
          if (isFP) continue;
          violations++;
          report.push({
            file: relative(process.cwd(), file),
            line: i + 1,
            phrase,
            context: lines[i].trim().slice(0, 120),
          });
        }
      }
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
