import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * L6 G1 assertion test (2026-04-18) — every `food_logged` emit site must
 * pass a `source:` property from the canonical `FoodLoggedSource` enum.
 *
 * This is the grep-level gate planner sign-off stipulated. It does NOT
 * check the value's shape (TypeScript does that at the call site via
 * the exported enum), only that SOMEWHERE in the call's argument object
 * literal a `source:` key appears. That's the signal we care about —
 * the prior regression was the single-meal `addLoggedMealForDate` emit
 * shipping `{ calories, fromPlanner }` with no source at all, which
 * made every F1/F2/F3 funnel unusable.
 *
 * The scan:
 *  - Walks `src/` + `apps/mobile/` (excluding node_modules + .expo + dist).
 *  - Looks at `.ts` / `.tsx` files only.
 *  - For every `AnalyticsEvents.food_logged` mention in a `track(…)`
 *    call, slurps up to the closing `)` of the call (with brace
 *    balancing) and asserts `source:` is present in the slurped
 *    substring.
 *
 * Matching is textual + multiline-aware on purpose. A mock emit in a
 * test file (where the payload is `{ event: "food_logged", ... }`
 * rather than `track(AnalyticsEvents.food_logged, …)`) is deliberately
 * NOT covered — this assertion guards production call sites.
 */

const REPO_ROOT = resolve(__dirname, "../..");

const SCAN_ROOTS = [
  join(REPO_ROOT, "src"),
  join(REPO_ROOT, "apps", "mobile"),
];

/** Directories to skip when walking. Node-modules + build artefacts. */
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".expo",
  ".next",
  "dist",
  "build",
  "coverage",
  "ios",
  "android",
]);

/** File extensions we care about. */
const INCLUDE_EXT = new Set([".ts", ".tsx"]);

function walk(dir: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIR_NAMES.has(name)) continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!st.isFile()) continue;
    const dot = name.lastIndexOf(".");
    if (dot < 0) continue;
    if (!INCLUDE_EXT.has(name.slice(dot))) continue;
    out.push(full);
  }
}

/** Slurp the `track(AnalyticsEvents.food_logged, { … })` call starting
 *  at `startIdx` (which points at the opening `(`). Returns `null` if
 *  the parens aren't balanced (malformed source we'd rather not false-
 *  positive on). Handles nested braces + parens; ignores string
 *  contents (can't contain `source:` that counts anyway). */
function readBalancedCall(src: string, startIdx: number): string | null {
  let depth = 0;
  let i = startIdx;
  let inString: '"' | "'" | "`" | null = null;
  for (; i < src.length; i++) {
    const ch = src[i]!;
    if (inString) {
      if (ch === "\\") {
        i++; // skip escape
        continue;
      }
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") {
      depth--;
      if (depth === 0) return src.slice(startIdx, i + 1);
    }
  }
  return null;
}

type Miss = { file: string; line: number; snippet: string };

function scanFile(absPath: string): Miss[] {
  const src = readFileSync(absPath, "utf8");
  // Fast reject: files that never mention `food_logged` can't offend.
  if (!src.includes("food_logged")) return [];
  const misses: Miss[] = [];
  // Match `track( … AnalyticsEvents.food_logged …` so we pick up
  // `track(\n  AnalyticsEvents.food_logged, {` as well as single-line
  // form. We search for the opening paren of `track(`.
  const re = /\btrack\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const openParen = m.index + m[0].length - 1;
    const call = readBalancedCall(src, openParen);
    if (!call) continue;
    if (!call.includes("AnalyticsEvents.food_logged")) continue;
    // Found a `track(AnalyticsEvents.food_logged, …)` call. Assert
    // the literal `source:` key appears inside the parentheses.
    if (!/\bsource\s*:/.test(call)) {
      // Compute the line number of the `track(` for the error msg.
      const line = src.slice(0, m.index).split(/\r?\n/).length;
      misses.push({
        file: relative(REPO_ROOT, absPath),
        line,
        snippet: call.length > 160 ? call.slice(0, 160) + "…" : call,
      });
    }
  }
  return misses;
}

describe("L6 G1 — every `food_logged` call site must pass `source`", () => {
  it("has no bare `track(AnalyticsEvents.food_logged, …)` emits anywhere under src/ or apps/mobile/", () => {
    const files: string[] = [];
    for (const root of SCAN_ROOTS) walk(root, files);
    // Sanity — scan must have found SOMETHING, otherwise the test
    // passes vacuously.
    expect(files.length).toBeGreaterThan(100);

    const misses: Miss[] = [];
    for (const f of files) {
      // Skip the grep test itself so the strings we're asserting on
      // don't false-positive the scanner. Also skip the analytics
      // events registry, whose JSDoc comments intentionally reference
      // `track(AnalyticsEvents.food_logged, …)` without being real
      // call sites.
      if (f.endsWith("foodLoggedSourceParity.test.ts")) continue;
      if (f.endsWith(`${"src"}/lib/analytics/events.ts`)) continue;
      misses.push(...scanFile(f));
    }

    if (misses.length > 0) {
      const lines = misses
        .map((x) => `  - ${x.file}:${x.line}\n      ${x.snippet}`)
        .join("\n");
      throw new Error(
        `Found ${misses.length} \`food_logged\` call site(s) without \`source:\`.\n` +
          `Every call must pass a \`FoodLoggedSource\` (see src/lib/analytics/events.ts).\n\n` +
          lines,
      );
    }
  });
});
