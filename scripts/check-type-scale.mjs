#!/usr/bin/env node

/**
 * ENG-119 — Type-ladder lint.
 *
 * Scans web component files for arbitrary Tailwind text-[Npx] classes
 * that fall outside the canonical type scale defined in theme.css:
 *
 *   11 | 13 | 15 | 18 | 22 | 24 | 28 | 36 px
 *
 * Also allows special-purpose sizes: 8, 9, 10 (micro labels, pill
 * badges — existing baseline, grandfathered). Display sizes above
 * 36 (40, 44, 48, 56, 64) are allowed for hero numerics.
 *
 * Exit 0 on clean, exit 1 with violation report otherwise.
 * Intended for `npm run check:type-scale` and CI.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ON_SCALE = new Set([8, 9, 10, 11, 13, 15, 18, 22, 24, 28, 36, 40, 44, 48, 56, 64]);
const SCAN_DIRS = ["src/app/components"];
const EXTENSIONS = new Set([".tsx", ".ts"]);

const PATTERN = /text-\[(\d+)px\]/g;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (EXTENSIONS.has(entry.name.slice(entry.name.lastIndexOf(".")))) {
      files.push(full);
    }
  }
  return files;
}

let violations = 0;
const report = [];

for (const scanDir of SCAN_DIRS) {
  for (const file of walk(scanDir)) {
    const content = readFileSync(file, "utf8");
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      let match;
      PATTERN.lastIndex = 0;
      while ((match = PATTERN.exec(lines[i])) !== null) {
        const px = parseInt(match[1], 10);
        if (!ON_SCALE.has(px)) {
          violations++;
          report.push({
            file: relative(process.cwd(), file),
            line: i + 1,
            size: `${px}px`,
            nearestOnScale: [...ON_SCALE].sort((a, b) => Math.abs(a - px) - Math.abs(b - px))[0] + "px",
          });
        }
      }
    }
  }
}

if (violations === 0) {
  console.log("✓ All text-[Npx] values are on the type scale.");
  process.exit(0);
}

console.log(`\n⚠ ${violations} off-scale text-[Npx] values found:\n`);
console.log("Type scale: 11 | 13 | 15 | 18 | 22 | 24 | 28 | 36 px");
console.log("(Micro: 8-10 allowed | Display: 40+ allowed)\n");

const bySize = {};
for (const v of report) {
  (bySize[v.size] ??= []).push(v);
}

for (const [size, items] of Object.entries(bySize).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
  console.log(`  ${size} → nearest on-scale: ${items[0].nearestOnScale} (${items.length} uses)`);
  for (const item of items.slice(0, 5)) {
    console.log(`    ${item.file}:${item.line}`);
  }
  if (items.length > 5) {
    console.log(`    ... and ${items.length - 5} more`);
  }
}

console.log(`\nTotal: ${violations} violations across ${Object.keys(bySize).length} off-scale sizes`);
process.exit(1);
