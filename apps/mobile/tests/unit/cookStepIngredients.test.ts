/**
 * Mobile parity for the ENG-944 "For this step" cook-mode chips.
 *
 * The matcher itself is exhaustively covered by the web suite
 * (`tests/unit/stepIngredients.test.ts`); this file pins the bits that are
 * MOBILE-specific:
 *
 *  1. The shared matcher resolves + behaves identically through the
 *     mobile `@suppr/shared/*` alias (parity by construction — same module).
 *  2. The flag gate: chips appear ONLY when the flag is ON.
 *  3. The `cook.tsx` route-param parse shape: a JSON `{ name, amount, unit }[]`
 *     round-trips into the matcher, and a malformed/absent param degrades
 *     to no chips (never throws).
 */
import { describe, expect, it } from "vitest";
import {
  cookStepIngredientChips,
  type StepMatchableIngredient,
} from "@suppr/shared/recipe-ingredients/stepIngredients";

/** Mirror of the fail-safe parse in `apps/mobile/app/cook.tsx` — kept here
 *  so the route-param contract is regression-tested without rendering the
 *  whole screen. */
function parseIngredientsParam(json: string | undefined): StepMatchableIngredient[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is Record<string, unknown> => r != null && typeof r === "object")
      .map((r) => ({
        name: typeof r.name === "string" ? r.name : "",
        amount:
          typeof r.amount === "string" || typeof r.amount === "number" ? r.amount : null,
        unit: typeof r.unit === "string" ? r.unit : null,
      }))
      .filter((r) => r.name.trim().length > 0);
  } catch {
    return [];
  }
}

describe("cook step ingredients — mobile shared-alias parity", () => {
  const ingredients: StepMatchableIngredient[] = [
    { name: "butter", amount: "2", unit: "tbsp" },
    { name: "garlic", amount: "2", unit: "cloves" },
    { name: "olive oil", amount: "1", unit: "tbsp" },
  ];

  it("matches and labels chips when the flag is ON", () => {
    expect(
      cookStepIngredientChips(true, "Melt the butter, then add garlic.", ingredients, 1),
    ).toEqual([
      { key: 0, label: "2 tbsp butter" },
      { key: 1, label: "2 cloves garlic" },
    ]);
  });

  it("renders nothing when the flag is OFF", () => {
    expect(
      cookStepIngredientChips(false, "Melt the butter, then add garlic.", ingredients, 1),
    ).toEqual([]);
  });

  it("scales amounts with the active cook scale", () => {
    expect(
      cookStepIngredientChips(true, "Pour in the olive oil.", ingredients, 0.5),
    ).toEqual([{ key: 2, label: "1/2 tbsp olive oil" }]);
  });

  it("returns no chips for a step with no ingredient (no empty label)", () => {
    expect(
      cookStepIngredientChips(true, "Rest the dough for 25 minutes.", ingredients, 1),
    ).toEqual([]);
  });
});

describe("cook.tsx ingredients route-param parse", () => {
  it("round-trips a JSON ingredient array into the matcher", () => {
    const json = JSON.stringify([
      { name: "butter", amount: "2", unit: "tbsp" },
      { name: "salt", amount: null, unit: null },
    ]);
    const parsed = parseIngredientsParam(json);
    expect(cookStepIngredientChips(true, "Add the butter and salt.", parsed, 1)).toEqual([
      { key: 0, label: "2 tbsp butter" },
      { key: 1, label: "salt" },
    ]);
  });

  it("degrades to [] for an absent param", () => {
    expect(parseIngredientsParam(undefined)).toEqual([]);
  });

  it("degrades to [] for malformed JSON (never throws)", () => {
    expect(parseIngredientsParam("{not json")).toEqual([]);
    expect(parseIngredientsParam("\"a string\"")).toEqual([]);
  });

  it("drops rows with no usable name", () => {
    const json = JSON.stringify([{ amount: "2", unit: "tbsp" }, { name: "  " }, { name: "egg" }]);
    expect(parseIngredientsParam(json)).toEqual([{ name: "egg", amount: null, unit: null }]);
  });
});
