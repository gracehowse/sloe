/**
 * Unit tests for the shared photo-import mapping (ENG-735 — bulk photo import
 * as the primary import path).
 *
 * `mapImageImportResponseToRecipe` is the single chokepoint both web
 * (`RecipeUpload.runBulkPhotoImport`) and mobile
 * (`import-shared.runImageImport`) feed every photo through, so the bulk
 * multi-photo path cannot drift between platforms. Each assertion maps to
 * something a user would see on the review step after a photo import, or to a
 * nutrition-correctness rule (no invented macros).
 */
import { describe, it, expect } from "vitest";
import {
  mapImageImportResponseToRecipe,
  photoSeedTitle,
  BULK_PHOTO_IMPORT_MAX,
  type ImageImportApiResponse,
} from "@/lib/recipes/photoImport";

const FULL: ImageImportApiResponse = {
  ok: true,
  title: "Roast Chicken",
  ingredients: ["1 whole chicken", "2 tbsp olive oil", "salt"],
  steps: ["Preheat oven", "Roast 1 hour"],
  notes: "Rest before carving",
  servings: 4,
  prepTimeMin: 15,
  cookTimeMin: 60,
  sourceUrl: "https://example.com/roast",
  sourceName: "Example",
  nutrition: {
    perServing: { calories: 520, protein: 42, carbs: 3, fat: 38, fiberG: 1, sugarG: 0, sodiumMg: 410 },
    overallConfidence: 0.81,
  },
};

describe("mapImageImportResponseToRecipe", () => {
  it("maps a full response into the canonical imported-recipe shape", () => {
    const r = mapImageImportResponseToRecipe(FULL);
    expect(r.title).toBe("Roast Chicken");
    expect(r.ingredients).toEqual(["1 whole chicken", "2 tbsp olive oil", "salt"]);
    expect(r.instructions).toEqual(["Preheat oven", "Roast 1 hour"]);
    expect(r.description).toBe("Rest before carving");
    expect(r.servings).toBe(4);
    expect(r.prepTimeMin).toBe(15);
    expect(r.cookTimeMin).toBe(60);
    expect(r.sourceUrl).toBe("https://example.com/roast");
    expect(r.sourceName).toBe("Example");
  });

  it("carries per-serving macros straight from the server's verified nutrition", () => {
    const r = mapImageImportResponseToRecipe(FULL);
    expect(r.calories).toBe(520);
    expect(r.protein).toBe(42);
    expect(r.carbs).toBe(3);
    expect(r.fat).toBe(38);
    expect(r.fiberG).toBe(1);
    expect(r.sodiumMg).toBe(410);
  });

  it("NEVER invents macros — leaves them null when the server returned no nutrition", () => {
    const r = mapImageImportResponseToRecipe({
      ok: true,
      ingredients: ["flour", "water"],
      nutrition: null,
    });
    // Repo no-guessing rule: a missing nutrition block must NOT become zeros
    // or estimates here — the review UI flags them as un-estimated instead.
    expect(r.calories).toBeNull();
    expect(r.protein).toBeNull();
    expect(r.carbs).toBeNull();
    expect(r.fat).toBeNull();
  });

  it("defaults a blank title to 'Photo Import' so the row is never empty", () => {
    expect(mapImageImportResponseToRecipe({ ok: true, ingredients: ["egg"], title: "  " }).title).toBe(
      "Photo Import",
    );
    expect(mapImageImportResponseToRecipe({ ok: true, ingredients: ["egg"] }).title).toBe(
      "Photo Import",
    );
  });

  it("defaults servings to 1 for a single photographed dish when unset or non-positive", () => {
    expect(mapImageImportResponseToRecipe({ ok: true, ingredients: ["x"] }).servings).toBe(1);
    expect(
      mapImageImportResponseToRecipe({ ok: true, ingredients: ["x"], servings: 0 }).servings,
    ).toBe(1);
    expect(
      mapImageImportResponseToRecipe({ ok: true, ingredients: ["x"], servings: -3 }).servings,
    ).toBe(1);
  });

  it("drops blank ingredient + step lines (resilient to ragged OCR output)", () => {
    const r = mapImageImportResponseToRecipe({
      ok: true,
      ingredients: ["  ", "tomato", ""],
      steps: ["", "chop"],
    });
    expect(r.ingredients).toEqual(["tomato"]);
    expect(r.instructions).toEqual(["chop"]);
  });

  it("leaves instructions undefined when no steps were extracted", () => {
    const r = mapImageImportResponseToRecipe({ ok: true, ingredients: ["x"], steps: [] });
    expect(r.instructions).toBeUndefined();
  });
});

describe("photoSeedTitle", () => {
  it("reads 'Photo' (singular) for a single pick", () => {
    expect(photoSeedTitle(1, 1)).toBe("Photo");
  });

  it("reads 'Photo N of M' for a multi-photo batch so the drawer rows are distinct", () => {
    expect(photoSeedTitle(1, 3)).toBe("Photo 1 of 3");
    expect(photoSeedTitle(3, 3)).toBe("Photo 3 of 3");
  });
});

describe("BULK_PHOTO_IMPORT_MAX", () => {
  it("is a sane positive ceiling (bounds the paid AI-vision fan-out per pick)", () => {
    expect(BULK_PHOTO_IMPORT_MAX).toBeGreaterThan(1);
    expect(Number.isInteger(BULK_PHOTO_IMPORT_MAX)).toBe(true);
  });
});
