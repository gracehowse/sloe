#!/usr/bin/env node

/**
 * ENG-1379 — JSX "space before a comment" text-node guard.
 *
 * Root cause of the ENG-1379 P0 (Settings screen crash under all-flags-on,
 * then found to fire in EVERY config): two lines shaped like
 *
 *     <TrendOnlyWeightRow /> {/* comment *\/}
 *
 * The space between a self-closing element (`/>`) — or an expression
 * close (`}`) — and a SAME-LINE JSX comment `{/* … *\/}` compiles to a
 * literal `" "` text node. When that text node is a direct child of a
 * non-`<Text>` element (a React Native `<View>`), RN throws
 * "Text strings must be rendered within a <Text> component." and the
 * surrounding layout can collapse. On web (React DOM) the same accident
 * is a harmless stray space — but it's still never intentional, and the
 * mobile mirror of a shared surface is a real crash, so we forbid it on
 * both platforms to keep parity twins honest.
 *
 * A space immediately before a JSX comment is ALWAYS accidental — you can
 * never see a comment, so a rendered space before one is never wanted.
 * That makes this a zero-tolerance guard (no pin/budget file): the fix is
 * always to move the comment onto its own line.
 *
 *     {/* comment *\/}
 *     <TrendOnlyWeightRow />
 *
 * Scope: `.tsx` under the mobile + web app/component surfaces (the JSX
 * that actually renders). Wired into `npm run ci`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Repo root. Prefer resolving relative to this file, but fall back to the
 * process cwd — under vitest `import.meta.url` isn't a `file://` URL, so
 * `fileURLToPath` throws. Both the CLI (`npm run` from repo root) and the
 * vitest runner execute from the repo root, so cwd is a safe fallback.
 */
function getRepoRoot() {
  try {
    if (typeof import.meta.url === "string" && import.meta.url.startsWith("file:")) {
      return fileURLToPath(new URL("..", import.meta.url));
    }
  } catch {
    /* fall through to cwd */
  }
  return process.cwd();
}

/** Surfaces that render JSX (mobile RN + web). */
const ROOTS = [
  "apps/mobile/app",
  "apps/mobile/components",
  "src",
  "app",
];

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", ".expo"]);

/**
 * A self-closing tag (`/>`) or an expression close (`}`), then one-or-more
 * spaces, then a JSX comment opener (`{/*`). The space is the offending
 * text node. Line-local: JSX comments and the preceding token are on one
 * line in every real instance of this bug.
 */
const PATTERN = /(\/>|\}) +\{\/\*/;

function walk(dir, out) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out; // root may not exist in every checkout slice
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(join(dir, entry.name), out);
    } else if (entry.isFile() && entry.name.endsWith(".tsx")) {
      out.push(join(dir, entry.name));
    }
  }
  return out;
}

/** @returns {{file:string,line:number,text:string}[]} */
export function findViolations(roots = ROOTS) {
  const repoRoot = getRepoRoot();
  const violations = [];
  for (const root of roots) {
    const abs = join(repoRoot, root);
    for (const file of walk(abs, [])) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((text, i) => {
        if (PATTERN.test(text)) {
          violations.push({
            file: relative(repoRoot, file),
            line: i + 1,
            text: text.trim(),
          });
        }
      });
    }
  }
  return violations;
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = findViolations();
  if (violations.length === 0) {
    console.log("check:jsx-text-node — clean (no space-before-comment text nodes).");
    process.exit(0);
  }
  console.error(
    `check:jsx-text-node — ${violations.length} space-before-comment text node(s) found.\n` +
      "A space before a JSX {/* comment */} is an accidental text node — it crashes\n" +
      "React Native when the parent isn't a <Text>. Move the comment onto its own line.\n",
  );
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  ${v.text}`);
  }
  process.exit(1);
}
