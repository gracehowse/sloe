/**
 * Structural pin: every import-driven recipe-insert caller imports the shared
 * `normaliseSource` helper and uses it at the insert / response-builder site.
 *
 * Context — TestFlight build 10 `AI-CNKcmy7y3fRqj6V0Yr4A` (2026-04-19).
 * Imported recipes rendered `Source · Esther Clark` as flat text because the
 * upstream import pipeline dropped `source_url`. The F-5 fix consolidated the
 * write boundary behind `src/lib/recipes/persistSourceAttribution.ts` so no
 * new caller can re-introduce the bug without this test failing.
 *
 * Callers audited:
 *   1. `apps/mobile/lib/saveImportedRecipe.ts` — mobile share-sheet + URL import.
 *   2. `src/app/components/RecipeUpload.tsx` — web URL-paste import + manual create.
 *   3. `app/api/recipe-import/route.ts` — web API response for all three tiers
 *      (HTML / website-linked social fallback / direct social caption).
 *
 * `apps/mobile/app/create-recipe.tsx` and the duplicate-draft path in
 * `src/context/AppDataContext.tsx` are manual-authoring flows with no URL
 * source at the insert site and are intentionally out of scope.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_SAVE_PATH = resolve(
  __dirname,
  "../../apps/mobile/lib/saveImportedRecipe.ts",
);
const WEB_UPLOAD_PATH = resolve(
  __dirname,
  "../../src/app/components/RecipeUpload.tsx",
);
const API_ROUTE_PATH = resolve(
  __dirname,
  "../../app/api/recipe-import/route.ts",
);
const HELPER_PATH = resolve(
  __dirname,
  "../../src/lib/recipes/persistSourceAttribution.ts",
);

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("persistSourceAttribution adoption", () => {
  it("helper file exports normaliseSource", () => {
    const src = read(HELPER_PATH);
    expect(src).toMatch(/export function normaliseSource/);
  });

  describe("apps/mobile/lib/saveImportedRecipe.ts", () => {
    const src = read(MOBILE_SAVE_PATH);

    it("imports normaliseSource from the shared helper", () => {
      expect(src).toMatch(/import\s*\{[^}]*normaliseSource[^}]*\}\s*from\s*["'][^"']*persistSourceAttribution[^"']*["']/);
    });

    it("calls normaliseSource at the write site", () => {
      expect(src).toMatch(/normaliseSource\s*\(\s*\{/);
    });

    it("still writes source_url + source_name keys on the recipes insert", () => {
      expect(src).toMatch(/source_url:\s*sourceUrl/);
      expect(src).toMatch(/source_name:\s*sourceName/);
    });

    it("no raw manual-trim shape survives alongside the helper", () => {
      // Guardrail: the old `((recipe.sourceUrl ?? …) ?? "").trim() || null` shape
      // should not coexist with the helper call. If someone re-introduces it the
      // helper's guarantees are bypassed.
      expect(src).not.toMatch(/recipe\.sourceUrl\s*\?\?[^;]+\)\.trim\(\)/);
    });
  });

  describe("src/app/components/RecipeUpload.tsx", () => {
    const src = read(WEB_UPLOAD_PATH);

    it("imports normaliseSource from the shared helper", () => {
      expect(src).toMatch(/import\s*\{[^}]*normaliseSource[^}]*\}\s*from\s*["'][^"']*persistSourceAttribution[^"']*["']/);
    });

    it("captures importedSourceUrl / importedSourceName state from URL import", () => {
      expect(src).toMatch(/setImportedSourceUrl/);
      expect(src).toMatch(/setImportedSourceName/);
    });

    it("runs normaliseSource on both the import-capture and save-upsert paths", () => {
      // There should be at least two normaliseSource(...) calls: one in
      // runImportFromUrl, one in the save boundary.
      const matches = src.match(/normaliseSource\s*\(/g) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it("upsert payload writes source_url + source_name keys", () => {
      expect(src).toMatch(/source_url:\s*attributionUrl/);
      expect(src).toMatch(/source_name:\s*attributionName/);
    });

    it("resetForm clears imported source state to prevent cross-import leak", () => {
      expect(src).toMatch(/setImportedSourceUrl\(null\)/);
      expect(src).toMatch(/setImportedSourceName\(null\)/);
    });
  });

  describe("app/api/recipe-import/route.ts", () => {
    const src = read(API_ROUTE_PATH);

    it("imports normaliseSource from the shared helper", () => {
      expect(src).toMatch(/import\s*\{[^}]*normaliseSource[^}]*\}\s*from\s*["'][^"']*persistSourceAttribution[^"']*["']/);
    });

    it("HTML branch response goes through normaliseSource and returns sourceUrl", () => {
      // The branch that builds the final `parsed` response must now include
      // both sourceUrl and sourceName derived from the helper.
      expect(src).toMatch(/sourceUrl:\s*attribution\.source_url/);
      expect(src).toMatch(/sourceName:\s*attribution\.source_name/);
    });

    it("social caption branch routes through normaliseSource", () => {
      expect(src).toMatch(/socialAttribution/);
      expect(src).toMatch(/sourceUrl:\s*socialAttribution\.source_url/);
    });

    it("website-linked social-fallback branch routes through normaliseSource", () => {
      expect(src).toMatch(/linkedAttribution/);
      expect(src).toMatch(/sourceUrl:\s*linkedAttribution\.source_url/);
    });
  });
});
