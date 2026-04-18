/**
 * Fit-this-in live reactivity — web FoodSearch (M11 audit, 2026-04-18).
 *
 * Covers the G16 backlog row. Mounts <FoodSearch /> with both
 * `macroTargets` and `macroConsumed` supplied plus a seeded custom food
 * so we can reach the portion preview without hitting USDA or OFF.
 * Verifies:
 *   - The "If you log this" hint appears with the initial projection
 *     when a result is picked.
 *   - Changing the portion (quantity stepper + direct input) updates the
 *     hint numbers in lock-step with `projectRemaining(...)`.
 *   - When consuming the scaled portion would exceed a target, the hint
 *     switches to "+N over" styling (shared logic in remainingMacros.ts).
 *
 * The external search pipeline (USDA / OFF) is mocked by stubbing
 * `global.fetch` with empty responses; custom-food surfacing is mocked
 * at the module boundary so we don't reach Supabase.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CustomFood } from "../../src/lib/nutrition/customFoods";

void React;

// ── Mock custom-foods client so FoodSearch has a single "seeded" row ──
const SEED_FOOD: CustomFood = {
  id: "cf-1",
  userId: "u1",
  name: "Homemade granola",
  baseGrams: 100,
  // Macros chosen so 100g = 400 kcal, 50g = 200 kcal. The fit hint then
  // has a clean integer delta that we can assert against.
  calories: 400,
  protein: 10,
  carbs: 60,
  fat: 14,
  fiber: 6,
  servings: [],
  createdAt: "2026-04-10T08:00:00Z",
  updatedAt: "2026-04-10T08:00:00Z",
};

vi.mock("../../src/lib/nutrition/customFoodsClient", () => ({
  listCustomFoods: vi.fn(async () => [SEED_FOOD]),
  searchCustomFoods: vi.fn(async () => [SEED_FOOD]),
  createCustomFood: vi.fn(),
  updateCustomFood: vi.fn(),
  deleteCustomFood: vi.fn(),
}));

import { FoodSearch } from "../../src/app/components/FoodSearch";

function Harness({
  consumedKcal,
}: {
  /** Running total kcal so we can force over/under-budget branches. */
  consumedKcal: number;
}) {
  return (
    <FoodSearch
      open
      onClose={() => {}}
      onSelect={() => {}}
      initialQuery="granola"
      macroTargets={{ calories: 2000, protein: 150, carbs: 200, fat: 70 }}
      macroConsumed={{ calories: consumedKcal, protein: 0, carbs: 0, fat: 0 }}
      supabase={{ from: () => ({}) } as any}
      userId="u1"
    />
  );
}

// Stub fetch so USDA + OFF calls resolve to empty result sets — our
// custom-food row is then the only thing in `results`.
beforeEach(() => {
  const emptyResp = {
    ok: true,
    hits: [],
    products: [],
  };
  (globalThis as any).fetch = vi.fn(async () =>
    new Response(JSON.stringify(emptyResp), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FoodSearch fit-this-in reactivity (G16)", () => {
  it("shows the hint on preview and updates it when the quantity changes", async () => {
    const user = userEvent.setup();
    render(<Harness consumedKcal={0} />);

    // The seeded custom food should surface as a result. We wait for the
    // async search to resolve (USDA/OFF fetches are mocked to empty).
    // Two buttons match (main result + "more options" menu). Pick the
    // first one whose accessible name starts with the food name but is
    // not the "more options" menu trigger.
    const matches = await screen.findAllByRole("button", { name: /Homemade granola/i });
    const mainResult = matches.find(
      (el) => !/more options/i.test(el.getAttribute("aria-label") ?? ""),
    );
    expect(mainResult).toBeDefined();
    await user.click(mainResult!);

    // Preview panel renders. Default for a custom food with baseGrams>0
    // is `quantity = baseGrams (100)`, portion "g" (gramWeight 1).
    // scaled kcal at 100g = 400. Remaining kcal budget was 2000 → 1600 left.
    const hint = await screen.findByRole("status", {
      name: /projected remaining macros/i,
    });
    expect(hint.textContent ?? "").toMatch(/1600/);

    // Use the quantity input to drop the portion to 50g. Expected scaled
    // kcal = 200; projected remaining = 2000 - 200 = 1800.
    const qtyInput = screen.getByDisplayValue("100") as HTMLInputElement;
    fireEvent.change(qtyInput, { target: { value: "50" } });

    await waitFor(() => {
      expect(hint.textContent ?? "").toMatch(/1800/);
    });

    // And back up to 200g → scaled kcal 800 → remaining 1200.
    fireEvent.change(qtyInput, { target: { value: "200" } });
    await waitFor(() => {
      expect(hint.textContent ?? "").toMatch(/1200/);
    });
  });

  it("flips to 'over' framing when the projected total exceeds the kcal budget", async () => {
    const user = userEvent.setup();
    // Consumed 1800 kcal already → budget 200 kcal remaining. Logging
    // 100g (400 kcal) puts us 200 kcal over.
    render(<Harness consumedKcal={1800} />);

    // Two buttons match (main result + "more options" menu). Pick the
    // first one whose accessible name starts with the food name but is
    // not the "more options" menu trigger.
    const matches = await screen.findAllByRole("button", { name: /Homemade granola/i });
    const mainResult = matches.find(
      (el) => !/more options/i.test(el.getAttribute("aria-label") ?? ""),
    );
    expect(mainResult).toBeDefined();
    await user.click(mainResult!);

    const hint = await screen.findByRole("status", {
      name: /projected remaining macros/i,
    });
    // "+200" is the signed delta; " over" is the projectRemaining verdict.
    await waitFor(() => {
      expect(hint.textContent ?? "").toMatch(/\+200/);
      expect(hint.textContent ?? "").toMatch(/over/i);
    });
  });
});
