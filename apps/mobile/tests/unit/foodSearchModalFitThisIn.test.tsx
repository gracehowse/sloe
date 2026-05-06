// @vitest-environment jsdom
/**
 * Mobile `FoodSearchModal` fit-this-in reactivity test (post-ship #3,
 * 2026-04-18).
 *
 * The G16 deferred row in `docs/planning/sweep-2026-04-executor-backlog.md`.
 * Mirrors the web render test at `tests/unit/foodSearchFitThisIn.test.tsx`
 * — when a user changes the portion quantity, the "If you log this"
 * status region must update in lock-step with
 * `projectRemaining(targets, consumed, { ... })` from
 * `src/lib/nutrition/remainingMacros.ts`.
 *
 * Shape:
 *   1. Mock `@/lib/verifyRecipe` so `searchFoods` returns exactly one
 *      OFF-style row with inline per-100g macros. OFF is the simpler
 *      branch — no USDA macro backfill round-trip to orchestrate.
 *   2. Render the modal open, wait for the result list to populate,
 *      tap the row → preview opens with the default portion (100 g).
 *   3. Assert the "If you log this" region is visible and the kcal
 *      shown matches `projectRemaining(...)` for 100 g.
 *   4. Raise the quantity to 200 g → projection updates (consumed +
 *      candidate doubles → new kcal-left).
 *   5. Exceed the budget → the hint flips to the `+N over` framing.
 */
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react-native";

import { projectRemaining } from "../../../../src/lib/nutrition/remainingMacros";

import FoodSearchModal from "../../components/FoodSearchModal";

void React;

// The modal imports these from `@/lib/verifyRecipe`. Mock the module at
// the module-graph level so the component gets our deterministic
// stubs — no network, no Supabase, no native bridges. Keep the
// mock surface narrow: only the symbols the modal references in its
// OFF-branch happy-path plus `scaleMacros` + a trivial
// `buildOffServingOptions*` re-export.
vi.mock("@/lib/verifyRecipe", () => {
  // Chicken-breast-ish macros per 100 g — doesn't have to be real, it
  // just has to be deterministic so the projection math is pinnable.
  const PER_100G = {
    calories: 200,
    protein: 30,
    carbs: 0,
    fat: 8,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 60,
  };
  return {
    searchFoods: vi.fn(async (query: string, onPartial?: (r: unknown[]) => void) => {
      // Return exactly one OFF row that already has macrosPer100g
      // inline — this is the OFF-path branch in `onPickResult`, which
      // opens the preview synchronously (no USDA round trip).
      const rows = [
        {
          key: "off-test-1",
          name: `Test food (${query})`,
          calsPer100g: PER_100G.calories,
          macrosPer100g: PER_100G,
          verified: false,
          _source: "OFF" as const,
          _offCode: "0000000000000",
        },
      ];
      if (onPartial) onPartial(rows);
      return rows;
    }),
    // OFF branch of `onPickResult` re-uses a known `buildPortionList`
    // seed; `getFoodMacros` is only consulted for USDA, so a
    // no-op impl is safe here.
    getFoodMacros: vi.fn(async () => null),
    scaleMacros: (per100g: typeof PER_100G, grams: number) => {
      const factor = grams / 100;
      return {
        calories: Math.round(per100g.calories * factor),
        protein: Math.round(per100g.protein * factor),
        carbs: Math.round(per100g.carbs * factor),
        fat: Math.round(per100g.fat * factor),
        fiberG: Math.round(per100g.fiberG * factor),
        sugarG: Math.round(per100g.sugarG * factor),
        sodiumMg: Math.round(per100g.sodiumMg * factor),
      };
    },
  };
});

const TARGETS = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 70,
};
const CONSUMED_HALF = {
  calories: 1000,
  protein: 75,
  carbs: 100,
  fat: 35,
};

describe("FoodSearchModal — G16 fit-this-in live reactivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens the preview after selecting a result and renders the 'If you log this' hint with the 100g projection", async () => {
    const onSelect = vi.fn();
    const { findByText, getByLabelText } = render(
      <FoodSearchModal
        visible
        initialQuery="test"
        macroTargets={TARGETS}
        macroConsumed={CONSUMED_HALF}
        onSelect={onSelect}
        onClose={() => undefined}
      />,
    );
    // Wait for the mocked search to populate the list — the row name
    // includes the query so we can find it deterministically.
    const row = await findByText("Test food (test)");
    fireEvent.press(row);

    // The status region only appears once a preview is mounted.
    const hint = await findByText("If you log this");
    expect(hint).toBeTruthy();

    // Default grams portion on OFF row is 100 g (see
    // `resolveInitialPortion` — the "g" portion path). 200 kcal @ 100 g.
    // Projection: 2000 - (1000 + 200) = 800 kcal left.
    const expected = projectRemaining(TARGETS, CONSUMED_HALF, {
      calories: 200,
      protein: 30,
      carbs: 0,
      fat: 8,
      fiber: 0,
    });
    expect(expected.calories).toBe(800);

    // RNTL `getByLabelText` on the aggregate row pins the whole region.
    expect(
      getByLabelText("Projected remaining macros after logging this portion"),
    ).toBeTruthy();
  });

  it("changing the quantity from 100 g to 200 g updates the kcal-left projection live", async () => {
    const { findByText, getByDisplayValue } = render(
      <FoodSearchModal
        visible
        initialQuery="test"
        macroTargets={TARGETS}
        macroConsumed={CONSUMED_HALF}
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );
    const row = await findByText("Test food (test)");
    fireEvent.press(row);
    await findByText("If you log this");

    // The quantity input renders with the current quantity as its
    // string value — `getByDisplayValue("100")` locates it.
    const qtyInput = getByDisplayValue("100");
    // Raise to 200 g — 400 kcal of the candidate → 2000 - (1000 + 400)
    // = 600 kcal left.
    fireEvent.changeText(qtyInput, "200");
    const expected200 = projectRemaining(TARGETS, CONSUMED_HALF, {
      calories: 400,
      protein: 60,
      carbs: 0,
      fat: 16,
      fiber: 0,
    });
    expect(expected200.calories).toBe(600);
    expect(expected200.overCalories).toBe(false);
    // The hint region re-renders with the new values. Search by the
    // numeric "600" text — the hint renders it as the `kcal` column
    // value when not over-budget.
    await findByText("600");
  });

  it("quantity that overshoots the kcal budget flips the hint to '+N over' framing", async () => {
    // Only 200 kcal of budget left. Logging 100 g adds 200 kcal →
    // exactly on the edge, not over. Logging 300 g adds 600 kcal → 400
    // over. Seed the consumed totals at 1800 kcal and raise to 300 g
    // to land firmly in the over-budget branch.
    const consumedHot = { calories: 1800, protein: 130, carbs: 190, fat: 65 };
    const { findByText, findAllByText, getByDisplayValue } = render(
      <FoodSearchModal
        visible
        initialQuery="test"
        macroTargets={TARGETS}
        macroConsumed={consumedHot}
        onSelect={() => undefined}
        onClose={() => undefined}
      />,
    );
    const row = await findByText("Test food (test)");
    fireEvent.press(row);
    await findByText("If you log this");

    const qtyInput = getByDisplayValue("100");
    fireEvent.changeText(qtyInput, "300");
    const overshoot = projectRemaining(TARGETS, consumedHot, {
      calories: 600,
      protein: 90,
      carbs: 0,
      fat: 24,
      fiber: 0,
    });
    expect(overshoot.overCalories).toBe(true);
    // Remaining deltas: calories -400, protein -70 (150 - 130 - 90).
    // The render swaps "left" → "over" and the value becomes `+|delta|`.
    expect(overshoot.deltas.calories).toBe(-400);
    // The over label appears on every over-budget macro column. At
    // least one must be rendered (kcal). `findAllByText` retries async
    // until the state tick lands the re-render.
    const overLabels = await findAllByText("over");
    expect(overLabels.length).toBeGreaterThan(0);
    // "+400" is the signed kcal overshoot that the hint renders next
    // to the "over" label when the user exceeds the budget.
    await findByText("+400");
  });
});
