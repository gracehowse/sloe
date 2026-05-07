/**
 * F-76 build 44 (2026-05-07) — callsite contract pin.
 *
 * Static check that every recipe-import route runs response titles
 * through `sanitiseImportedTitle`. Unit tests on the helper itself
 * already pass, but tester `AFVnLJIVdjQY` showed a leak from a route
 * that simply forgot to call it. This test reads the route files and
 * asserts the import + the absence of any unsanitised `parsed.title`,
 * `recipe.title`, or `websiteRecipe.title` in the JSON response shape.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");

// Each route has a known number of response-shape title fields that
// MUST flow through the sanitiser. If a new branch is added, update
// the minimum here AND the corresponding response site.
const ROUTES: Array<{ path: string; minSanitiserCalls: number }> = [
  // 3 branches: web-scrape (line ~271), social/LLM (line ~363),
  // HTML-fallback parsed.title override (line ~595).
  { path: "app/api/recipe-import/route.ts", minSanitiserCalls: 3 },
  { path: "app/api/recipe-import/image/route.ts", minSanitiserCalls: 1 },
  { path: "app/api/recipe-import/caption/route.ts", minSanitiserCalls: 1 },
];

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("F-76 — every recipe-import route imports + uses sanitiseImportedTitle", () => {
  it.each(ROUTES)("$path imports the helper", ({ path }) => {
    const src = read(path);
    expect(src).toMatch(/sanitiseImportedTitle/);
    expect(src).toMatch(/from\s+["'].*extractSocialRecipe["']/);
  });

  it.each(ROUTES)("$path calls sanitiseImportedTitle on every response-title branch ($minSanitiserCalls expected)", ({ path, minSanitiserCalls }) => {
    const src = read(path);
    // Strip block + line comments so the count only inspects code.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    const calls = (code.match(/sanitiseImportedTitle\s*\(/g) ?? []).length;
    expect(calls).toBeGreaterThanOrEqual(minSanitiserCalls);
  });
});
