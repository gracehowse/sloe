#!/usr/bin/env node
/**
 * ENG-1281 step 2 — safe literal→token migration.
 * Only replaces `fontSize: 12,` / `fontSize: 15,` when the same
 * `{...}` block has no fontWeight/fontFamily (spread-safe).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SCAN_DIRS = ["apps/mobile/app", "apps/mobile/components"];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

function ensureTypeImport(src) {
  if (/import\s*\{[^}]*\bType\b[^}]*\}\s*from\s*["']@\/constants\/theme["']/.test(src)) {
    return src;
  }
  const themeImport =
    /import\s*\{([^}]+)\}\s*from\s*["']@\/constants\/theme["']/;
  const m = src.match(themeImport);
  if (m) {
    const names = m[1]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!names.includes("Type")) {
      names.push("Type");
      return src.replace(
        themeImport,
        `import { ${names.join(", ")} } from "@/constants/theme"`,
      );
    }
    return src;
  }
  const firstImport = src.match(/^import .+$/m);
  const line = 'import { Type } from "@/constants/theme";';
  if (firstImport) {
    return src.replace(firstImport[0], `${firstImport[0]}\n${line}`);
  }
  return `${line}\n${src}`;
}

function migrateFile(src) {
  const lines = src.split("\n");
  let changed = false;
  const out = lines.map((line) => {
    if (!/fontSize:\s*(12|15),/.test(line)) return line;
    if (/fontSize:\s*12\.5|fontSize:\s*15\.5/.test(line)) return line;
    if (/fontWeight:|fontFamily:/.test(line)) return line;
    let next = line.replace(/fontSize:\s*12,/g, "...Type.captionSmall,");
    next = next.replace(/fontSize:\s*15,/g, "...Type.bodyLarge,");
    if (next !== line) changed = true;
    return next;
  });
  if (!changed) return src;
  return ensureTypeImport(out.join("\n"));
}

let files = 0;
let reps = 0;

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const rel = relative(ROOT, file);
    const src = readFileSync(file, "utf8");
    const before = (src.match(/fontSize:\s*(12|15),/g) || []).length;
    const next = migrateFile(src);
    if (next !== src) {
      const after = (next.match(/fontSize:\s*(12|15),/g) || []).length;
      reps += before - after;
      writeFileSync(file, next);
      files++;
    }
  }
}

console.log(`ENG-1281 safe migrate: ${reps} replacements in ${files} files`);
