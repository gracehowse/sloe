/**
 * ENG-1601 — mobile plan-import auto-rebalance must use the user's real
 * nutrition targets, never a hardcoded/fabricated number.
 *
 * Bug: `apps/mobile/app/plan-import.tsx` auto-rebalanced an imported plan
 * against a hardcoded `useState(2000)` kcal target with macro splits
 * derived as flat percentages of that fabricated number, instead of the
 * user's real `profiles.target_*` columns (resolved via the same
 * `resolveTargets` fallback chain — explicit DB target → computed from
 * body stats → NUTRITION_DEFAULTS — that `planner.tsx` already uses).
 * Web's reference implementation (`src/app/components/plan-import/usePlanImport.ts`)
 * has always used the real `useAppData().nutritionTargets`.
 *
 * The real fetch + resolveTargets logic lives in
 * `usePlanImportNutritionTargets.ts` (extracted out of the screen file
 * in a hotfix to stay under the screen's pinned line budget) — this
 * file checks both: the hook's resolution chain, and that the screen
 * consumes it instead of any ad hoc math.
 *
 * Structural source-pin test (matches the existing
 * `planImportLaunchGate.test.ts` convention for this hard-to-render
 * Expo Router + Supabase screen) rather than a full component render.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(resolve(__dirname, "../../app/plan-import.tsx"), "utf8");
const HOOK_SRC = readFileSync(
  resolve(__dirname, "../../hooks/usePlanImportNutritionTargets.ts"),
  "utf8",
);
const PLANNER_SRC = readFileSync(resolve(__dirname, "../../app/(tabs)/planner.tsx"), "utf8");

describe("plan-import.tsx — real nutrition targets (ENG-1601)", () => {
  it("no longer hardcodes a 2000kcal target", () => {
    expect(SRC).not.toMatch(/useState\(\s*2000\s*\)/);
    expect(SRC).not.toMatch(/userTargetKcal/);
  });

  it("no longer derives macros as flat percentages of a single number", () => {
    expect(SRC).not.toMatch(/\*\s*0\.075/);
    expect(SRC).not.toMatch(/\*\s*0\.125/);
    expect(SRC).not.toMatch(/\*\s*0\.035/);
  });

  it("consumes the shared usePlanImportNutritionTargets hook, not inline fetch/resolve logic", () => {
    expect(SRC).toMatch(
      /import \{ usePlanImportNutritionTargets \} from "@\/hooks\/usePlanImportNutritionTargets"/,
    );
    expect(SRC).toMatch(/usePlanImportNutritionTargets\(userId\)/);
    expect(SRC).not.toMatch(/\.from\("profiles"\)/);
    expect(SRC).not.toMatch(/resolveTargets\(/);
  });

  it("the rebalance call passes real per-macro targets, not derived fractions", () => {
    const rebalanceCall = SRC.match(
      /rebalanceImportedPlanDays\(\{[\s\S]*?targets:\s*\{([\s\S]*?)\},[\s\S]*?\}\);/,
    );
    expect(rebalanceCall).not.toBeNull();
    const body = rebalanceCall![1];
    expect(body).toMatch(/calories:\s*nutritionTargets\.calories,/);
    expect(body).toMatch(/protein:\s*nutritionTargets\.protein,/);
    expect(body).toMatch(/carbs:\s*nutritionTargets\.carbs,/);
    expect(body).toMatch(/fat:\s*nutritionTargets\.fat,/);
    expect(body).toMatch(/fiber:\s*nutritionTargets\.fiber,/);
  });

  it("planner.tsx's own profile-select column list is unchanged (parity reference, not touched by this fix)", () => {
    expect(PLANNER_SRC).toMatch(
      /target_calories, target_protein, target_carbs, target_fat, target_fiber_g/,
    );
  });
});

describe("usePlanImportNutritionTargets — real fetch + resolution chain (ENG-1601)", () => {
  it("fetches the user's real profile targets via the same columns planner.tsx uses", () => {
    expect(HOOK_SRC).toMatch(
      /target_calories, target_protein, target_carbs, target_fat, target_fiber_g/,
    );
    expect(HOOK_SRC).toMatch(/\.from\("profiles"\)/);
  });

  it("resolves targets through the shared resolveTargets fallback chain (not ad hoc math)", () => {
    expect(HOOK_SRC).toMatch(/import \{ resolveTargets \} from "@\/lib\/calcTargets"/);
    expect(HOOK_SRC).toMatch(/resolveTargets\(/);
  });

  it("starts from NUTRITION_DEFAULTS (the sanctioned fallback) while the fetch is in flight, never a fabricated literal", () => {
    expect(HOOK_SRC).toMatch(
      /import \{ NUTRITION_DEFAULTS \} from "@\/constants\/nutritionDefaults"/,
    );
    expect(HOOK_SRC).toMatch(/calories: NUTRITION_DEFAULTS\.calories/);
  });
});
