/**
 * onboardingFirstWeekPhase5 — pins the Phase 5 / B2.3 first-week plan
 * generation + persistence flow.
 *
 * Authority: D-2026-04-27-14 (onboarding produces first plan).
 * Source: src/lib/onboarding/onboardingFirstWeek.ts
 *
 * Coverage:
 *   - seedsToPlannerRecipes converts seed shape into SimpleRecipe with
 *     plausible carbs / fat / fibre defaults.
 *   - buildFirstWeekFromSeeds passes resolved recipes to generateSmartPlan
 *     and persists via the `save_meal_plan` RPC.
 *   - RPC error → result.ok=false, error string carried.
 *   - Empty resolved list → defensive guard, no I/O, ok=false.
 */

import { describe, it, expect, vi } from "vitest";

import {
  buildFirstWeekFromSeeds,
  seedsToPlannerRecipes,
} from "../../src/lib/onboarding/onboardingFirstWeek";
import type { OnboardingSeed } from "../../src/lib/onboarding/onboardingSeeds";

function makeSeed(slug: string, kcal: number, protein: number): OnboardingSeed {
  return {
    slug,
    matchTitle: slug,
    title: slug,
    kcal,
    protein_g: protein,
    prepMins: 30,
    dietTags: [],
    cuisine: "test",
    heroEmoji: "🍽️",
  };
}

describe("seedsToPlannerRecipes", () => {
  it("preserves kcal + protein + assigns plausible carb/fat/fibre", () => {
    const result = seedsToPlannerRecipes([
      { seed: makeSeed("a", 540, 45), recipeId: "r-1" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("r-1");
    expect(result[0].calories).toBe(540);
    expect(result[0].protein).toBe(45);
    // Carbs + fat make up the remainder of the kcal envelope after
    // protein. Both should be positive integers.
    expect(result[0].carbs).toBeGreaterThan(0);
    expect(result[0].fat).toBeGreaterThan(0);
    // Fibre default — see file header.
    expect(result[0].fiberG).toBe(5);
  });

  it("clamps non-positive kcal to a safe floor", () => {
    const result = seedsToPlannerRecipes([
      { seed: makeSeed("a", -10, 0), recipeId: "r-1" },
    ]);
    expect(result[0].calories).toBeGreaterThanOrEqual(50);
  });
});

describe("buildFirstWeekFromSeeds — happy path", () => {
  it("calls save_meal_plan rpc with the generated plan", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = { rpc: rpcMock };

    const result = await buildFirstWeekFromSeeds(supabase as never, {
      userId: "u-1",
      resolved: [
        { seed: makeSeed("a", 540, 45), recipeId: "r-1" },
        { seed: makeSeed("b", 480, 38), recipeId: "r-2" },
        { seed: makeSeed("c", 620, 35), recipeId: "r-3" },
        { seed: makeSeed("d", 510, 28), recipeId: "r-4" },
        { seed: makeSeed("e", 590, 42), recipeId: "r-5" },
      ],
      targets: {
        calories: 2100,
        proteinG: 150,
        carbsG: 220,
        fatG: 70,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.daysGenerated).toBeGreaterThan(0);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [name, args] = rpcMock.mock.calls[0];
    expect(name).toBe("save_meal_plan");
    expect(args.p_plan).toBeDefined();
    expect(args.p_start_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("buildFirstWeekFromSeeds — failure modes", () => {
  it("returns ok=false on empty resolved list (no I/O)", async () => {
    const rpcMock = vi.fn();
    const supabase = { rpc: rpcMock };
    const result = await buildFirstWeekFromSeeds(supabase as never, {
      userId: "u-1",
      resolved: [],
      targets: { calories: 2000, proteinG: 100, carbsG: 200, fatG: 70 },
    });
    expect(result.ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("surfaces RPC error string when persist fails", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "RLS rejected" },
    });
    const supabase = { rpc: rpcMock };

    const result = await buildFirstWeekFromSeeds(supabase as never, {
      userId: "u-1",
      resolved: [
        { seed: makeSeed("a", 540, 45), recipeId: "r-1" },
        { seed: makeSeed("b", 480, 38), recipeId: "r-2" },
        { seed: makeSeed("c", 620, 35), recipeId: "r-3" },
        { seed: makeSeed("d", 510, 28), recipeId: "r-4" },
        { seed: makeSeed("e", 590, 42), recipeId: "r-5" },
      ],
      targets: { calories: 2100, proteinG: 150, carbsG: 220, fatG: 70 },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("RLS rejected");
  });
});
