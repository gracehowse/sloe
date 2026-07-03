import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  buildOnboardingRecipeImportSummary,
  ONBOARDING_SAMPLE_RECIPE_URL,
  useOnboardingRecipeImport,
} from "../../src/lib/onboarding/useOnboardingRecipeImport";
import type { ApiImportedRecipe } from "../../src/lib/recipes/persistImportedRecipe";

describe("buildOnboardingRecipeImportSummary", () => {
  it("derives display fields from an imported recipe", () => {
    const recipe: ApiImportedRecipe = {
      title: "Best lentil soup",
      servings: 4,
      prepTimeMin: 10,
      cookTimeMin: 35,
      calories: 320,
      protein: 18,
      carbs: 42,
      fat: 8,
    };
    const summary = buildOnboardingRecipeImportSummary(
      recipe,
      "https://cookieandkate.com/best-lentil-soup-recipe/",
    );
    expect(summary.title).toBe("Best lentil soup");
    expect(summary.servings).toBe(4);
    expect(summary.totalMinutes).toBe(45);
    expect(summary.calories).toBe(320);
    expect(summary.sourceHost).toBe("cookieandkate.com");
  });
});

describe("useOnboardingRecipeImport", () => {
  it("runs sample import and lands in success", async () => {
    const runImport = vi.fn(async () =>
      buildOnboardingRecipeImportSummary(
        { title: "Sample", calories: 100, protein: 5, carbs: 10, fat: 2 },
        ONBOARDING_SAMPLE_RECIPE_URL,
      ),
    );
    const { result } = renderHook(() => useOnboardingRecipeImport(runImport));

    await act(async () => {
      result.current.importSample();
    });

    expect(runImport).toHaveBeenCalledWith(ONBOARDING_SAMPLE_RECIPE_URL);
    expect(result.current.phase).toBe("success");
    expect(result.current.summary?.title).toBe("Sample");
  });

  it("surfaces import failures in error phase", async () => {
    const runImport = vi.fn(async () => {
      throw new Error("Couldn't parse that link.");
    });
    const { result } = renderHook(() => useOnboardingRecipeImport(runImport));

    act(() => {
      result.current.setUrl("https://example.com/recipe");
    });
    await act(async () => {
      await result.current.importCurrentUrl();
    });

    expect(result.current.phase).toBe("error");
    expect(result.current.errorMessage).toContain("Couldn't parse");
  });
});
