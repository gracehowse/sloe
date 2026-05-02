/**
 * F-13 (2026-04-19) — parity pin: every food-log write call site on
 * BOTH platforms must import the shared `updateStimulantsForDay` helper
 * so a future refactor cannot accidentally leave one platform auto-
 * tracking caffeine / alcohol while the other drops the delta.
 *
 * The pin fails if any of the load-bearing files forget to import the
 * helper. It does NOT check the exact call shape — TypeScript guards
 * that via the helper's exported signature — only that the import is
 * present. This is the same style of assertion used by
 * `foodLoggedSourceParity.test.ts` and keeps the rule cheap to run.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../..");

/**
 * Files that insert or delete `nutrition_entries` rows and therefore
 * must keep the daily caffeine/alcohol totals in sync.
 *
 * The architecture splits responsibility:
 *   - Commit hosts (NutritionTracker, (tabs)/index, (tabs)/barcode) run
 *     grams through `scaleCaffeineAlcohol` and stash the delta on the
 *     meal's `micros` map.
 *   - Persistence seams (useNutritionJournalState, (tabs)/index delete,
 *     (tabs)/barcode log) call `updateStimulantsForDay` to bump
 *     `profiles.extra_{caffeine,alcohol_g}_by_day`.
 * Some files span both roles — (tabs)/index does the commit + delete on
 * mobile, (tabs)/barcode does the commit + bump inline.
 *
 * Deliberately narrow: recipe-log paths don't auto-track today
 * because recipes don't carry aggregated caffeine/alcohol nutrients
 * (the verifier surfaces them per-ingredient — see scope cap doc at
 * docs/decisions/2026-05-01-tracking-extras-autoupdate.md). Meal-plan
 * logs DO bump now (2026-05-01) because the verifier-fed
 * `nutrition_micros` map carries scaled caffeine / alcohol when the
 * underlying recipe has them.
 *
 * Quick-add / Eat-again paths are covered indirectly: web piggybacks
 * on `addLoggedMeal` (which already imports `updateStimulantsForDay`)
 * and mobile inlines the call inside `(tabs)/index.tsx`, which is
 * already pinned below.
 */
const SITES: Array<{
  path: string;
  why: string;
  mustImport: ReadonlyArray<"updateStimulantsForDay" | "scaleCaffeineAlcohol">;
}> = [
  {
    path: "src/context/appData/useNutritionJournalState.ts",
    why: "Web single-meal + bulk insert + delete (the persistence seam)",
    mustImport: ["updateStimulantsForDay"],
  },
  {
    path: "src/app/components/NutritionTracker.tsx",
    why: "Web FoodSearch + barcode commit hosts (scale on the way in)",
    mustImport: ["scaleCaffeineAlcohol"],
  },
  {
    path: "apps/mobile/app/(tabs)/index.tsx",
    why: "Mobile Today commit + deleteMeal (both commit + seam)",
    mustImport: ["updateStimulantsForDay", "scaleCaffeineAlcohol"],
  },
  {
    path: "apps/mobile/app/(tabs)/barcode.tsx",
    why: "Mobile /barcode tab log (commit + seam inline)",
    mustImport: ["updateStimulantsForDay", "scaleCaffeineAlcohol"],
  },
];

describe("F-13 stimulants auto-track parity pin", () => {
  for (const site of SITES) {
    for (const symbol of site.mustImport) {
      it(`${site.path} imports ${symbol} (${site.why})`, () => {
        const src = readFileSync(resolve(REPO_ROOT, site.path), "utf8");
        expect(
          src.includes(symbol),
          `${site.path} must import / call ${symbol} so caffeine + alcohol stay in sync on that platform's log / delete path.`,
        ).toBe(true);
      });
    }
  }
});
