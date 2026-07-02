import { describe, expect, it } from "vitest";

import {
  buildRecipeYieldPersistence,
  recipeYieldEditorDraftFromDb,
  validateRecipeYieldEditorDraft,
} from "@/lib/recipes/recipeYieldEditor";

describe("recipeYieldEditor", () => {
  it("defaults to servings-only when yield is null", () => {
    const draft = recipeYieldEditorDraftFromDb(null, 4);
    expect(draft.mode).toBe("servings_only");
    expect(draft.servings).toBe(4);
    expect(buildRecipeYieldPersistence(draft)).toEqual({ servings: 4, yield: null });
  });

  it("hydrates weight + units drafts from jsonb", () => {
    const draft = recipeYieldEditorDraftFromDb(
      { kind: "weight_and_units", totalGrams: 400, unitCount: 8, singular: "slice" },
      4,
    );
    expect(draft.mode).toBe("weight_and_units");
    expect(draft.totalGrams).toBe("400");
    expect(draft.unitCount).toBe("8");
    expect(draft.unitSingular).toBe("slice");
  });

  it("validates required fields per mode", () => {
    expect(
      validateRecipeYieldEditorDraft({
        mode: "weight",
        servings: 4,
        totalGrams: "",
        unitCount: "",
        unitSingular: "",
      }),
    ).toMatch(/weight/i);
    expect(
      validateRecipeYieldEditorDraft({
        mode: "units",
        servings: 4,
        totalGrams: "",
        unitCount: "12",
        unitSingular: "bar",
      }),
    ).toBeNull();
  });

  it("serialises structured yield for persistence", () => {
    const out = buildRecipeYieldPersistence({
      mode: "weight",
      servings: 2,
      totalGrams: "500",
      unitCount: "",
      unitSingular: "",
    });
    expect(out).toEqual({
      servings: 2,
      yield: { kind: "weight", totalGrams: 500 },
    });
  });
});
