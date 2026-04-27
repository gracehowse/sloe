/**
 * P0-5 (2026-04-25) — pins the sampler cap on `findBestMealSet` so future
 * regressions (raising the cap, decoupling web from mobile) fail at PR
 * time rather than as a 6–11s UI freeze in production.
 *
 * Background: pre-fix the cap was an inline `20_000` literal in BOTH
 * `src/lib/nutrition/mealPlanAlgo.ts` and `src/lib/planning/generateMealPlan.ts`.
 * Mobile generated plans against ~30 recipes × 4 slots → 6–11 second
 * blocking JS execution. Web ran the same cap. The cap is now a single
 * exported constant (`MEAL_PLAN_SAMPLER_CAP`) shared between the two
 * algorithms; both files import it from `mealPlanAlgo.ts`.
 *
 * If a future change wants to raise the cap, the dial is intentional —
 * touch this test, add a benchmark in CI, and document the trade-off in
 * a decision doc.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MEAL_PLAN_SAMPLER_CAP } from "../../src/lib/nutrition/mealPlanAlgo";

const REPO = resolve(__dirname, "../..");

describe("MEAL_PLAN_SAMPLER_CAP", () => {
  it("is set to 2_000 and exported as the single source of truth", () => {
    expect(MEAL_PLAN_SAMPLER_CAP).toBe(2_000);
  });

  it("is referenced by the generic sampler in mealPlanAlgo.ts (web now consumes it via the import, P2-28)", () => {
    const mobile = readFileSync(
      resolve(REPO, "src/lib/nutrition/mealPlanAlgo.ts"),
      "utf8",
    );
    const web = readFileSync(
      resolve(REPO, "src/lib/planning/generateMealPlan.ts"),
      "utf8",
    );

    // P2-28 (2026-04-25): post-dedup, the cap is referenced from the
    // single shared `findBestMealSetGeneric<R>` in mealPlanAlgo.ts. The
    // web file no longer references the constant directly — it calls
    // the generic, which uses the cap internally.
    expect(mobile).toMatch(/Math\.min\(\s*MEAL_PLAN_SAMPLER_CAP/);
    expect(web).toMatch(/findBestMealSetGeneric/);

    // Neither file should still carry the old 20_000 inline literal in
    // the sampler section. (The string '20_000' may still appear in
    // documentation comments — search only for it as a numeric literal
    // in a Math.min call.)
    expect(mobile).not.toMatch(/Math\.min\(\s*20_000\b/);
    expect(web).not.toMatch(/Math\.min\(\s*20_000\b/);
  });
});
